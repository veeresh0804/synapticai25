

import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson, handleFunctionError } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();

    const _body = await safeReqJson(req, "interview-sim", requestId);
    if (!_body.ok) return _body.response;
    const { messages, role, difficulty, student_profile } = _body.value as any;
    if (!messages || !role) throw new Error("messages and role required");
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return errorResponse({ fn: "interview-sim", code: "bad_request", message: "messages must be an array of 1-50 items.", requestId });
    }
    for (const m of messages) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || m.content.length === 0 || m.content.length > 8000) {
        return errorResponse({ fn: "interview-sim", code: "bad_request", message: "Each message needs role user|assistant and content 1-8000 chars.", requestId });
      }
    }
    if (String(role).length > 120) {
      return errorResponse({ fn: "interview-sim", code: "bad_request", message: "role too long.", requestId });
    }

    const systemPrompt = `You are an expert ${difficulty || 'medium'}-level technical interviewer conducting a mock interview for the role of "${role}".

${student_profile ? `Candidate Background: ${JSON.stringify(student_profile)}` : ""}

Rules:
- Ask ONE question at a time
- After the candidate answers, provide brief feedback (1-2 sentences) then ask the next question
- Mix behavioral and technical questions relevant to the role
- Be encouraging but honest about areas for improvement
- Track question number (aim for 5-7 questions per session)
- When you've asked enough questions, provide a final assessment with:
  * Overall score (0-100)
  * Strengths identified
  * Areas for improvement
  * Tips for real interviews
- Format your final assessment clearly with "## Final Assessment" header
- Use markdown for formatting`;

    const response = await callAI({
      model: "google/gemini-3.5-flash-lite", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse({ fn: "interview-sim", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "interview-sim", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    } catch (e) {
      return handleFunctionError("interview-sim", e, "Failed to run interview simulation", requestId);
    }
  }),
};

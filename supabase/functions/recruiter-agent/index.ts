import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson, handleFunctionError } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();

    const _body = await safeReqJson(req, "recruiter-agent", requestId);
    if (!_body.ok) return _body.response;
    const { messages, recruiter_context } = _body.value as any;
    if (!messages) throw new Error("messages required");
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return errorResponse({ fn: "recruiter-agent", code: "bad_request", message: "messages must be an array of 1-50 items.", requestId });
    }
    for (const m of messages) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || m.content.length === 0 || m.content.length > 8000) {
        return errorResponse({ fn: "recruiter-agent", code: "bad_request", message: "Each message needs role user|assistant and content 1-8000 chars.", requestId });
      }
    }
    if (recruiter_context && JSON.stringify(recruiter_context).length > 20000) {
      return errorResponse({ fn: "recruiter-agent", code: "bad_request", message: "recruiter_context too large.", requestId });
    }

    const systemPrompt = `You are an autonomous AI recruiting assistant for SynapticAI platform. You help recruiters with hiring decisions.

Recruiter Context:
${JSON.stringify(recruiter_context || {})}

You can help with:
1. **Candidate Analysis**: Evaluate candidate profiles, compare strengths
2. **Job Description Writing**: Draft compelling, inclusive job posts
3. **Interview Planning**: Suggest interview questions for specific roles
4. **Pipeline Strategy**: Advise on hiring funnel optimization
5. **Talent Insights**: Analyze talent pool trends and recommendations
6. **Outreach Templates**: Draft candidate outreach messages
7. **Offer Negotiation**: Suggest competitive compensation packages

Rules:
- Be concise and actionable
- Use data from the recruiter's context when available
- Provide specific, implementable suggestions
- Format responses with markdown for readability
- When asked about candidates, provide structured comparisons
- Proactively suggest next steps`;

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
      if (status === 429) return errorResponse({ fn: "recruiter-agent", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "recruiter-agent", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    } catch (e) {
      return handleFunctionError("recruiter-agent", e, "Failed to run recruiter agent", requestId);
    }
  }),
};

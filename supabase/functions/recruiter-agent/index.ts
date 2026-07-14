import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {

    const { messages, recruiter_context } = await req.json();
    if (!messages) throw new Error("messages required");

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
      model: "google/gemini-2.0-flash", // TODO: verify model name against Google AI Studio's current model list
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
      return internalError("recruiter-agent", e, "Failed to run recruiter agent", requestId);
    }
  }),
};

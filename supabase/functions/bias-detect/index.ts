

import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson, handleFunctionError } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();

    const _body = await safeReqJson(req, "bias-detect", requestId);
    if (!_body.ok) return _body.response;
    const { job_description, job_title, required_skills } = _body.value as any;
    if (!job_description) throw new Error("job_description required");
    if (String(job_description).length > 20000 || JSON.stringify(_body.value).length > 50000) {
      return errorResponse({ fn: "bias-detect", code: "bad_request", message: "Payload too large (max ~50KB).", requestId });
    }

    const prompt = `You are an AI Hiring Bias Detector. Analyze the following job posting for potential biases that could discourage diverse candidates.

Job Title: ${job_title || "Unknown"}
Required Skills: ${JSON.stringify(required_skills || [])}
Job Description:
${job_description}

Check for these bias categories:
1. Gender bias: Gendered language ("rockstar", "ninja", "manpower"), pronouns
2. Age bias: "Digital native", "young and dynamic", excessive years of experience
3. Cultural bias: Assumptions about background, "culture fit" language
4. Disability bias: Unnecessary physical requirements, "fast-paced" overuse
5. Education bias: Unnecessary degree requirements for skill-based roles
6. Socioeconomic bias: Unpaid internships, relocation without support

Return a JSON object with this EXACT structure:
{
  "bias_score": <number 0-100, where 0 is no bias and 100 is highly biased>,
  "overall_rating": "excellent" | "good" | "needs_improvement" | "problematic",
  "findings": [
    {
      "category": "gender" | "age" | "cultural" | "disability" | "education" | "socioeconomic",
      "severity": "low" | "medium" | "high",
      "problematic_text": "<the exact problematic text from the JD>",
      "explanation": "<why this is biased>",
      "suggestion": "<inclusive alternative>"
    }
  ],
  "inclusive_score": <number 0-100>,
  "summary": "<2-3 sentence summary>",
  "rewritten_sections": [
    {"original": "<problematic text>", "improved": "<inclusive version>"}
  ]
}

Return ONLY valid JSON, no markdown.`;

    const response = await callAI({
      model: "google/gemini-3.6-flash", // TODO: verify model name against Google AI Studio's current model list
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse({ fn: "bias-detect", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "bias-detect", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let result: any;
    try { result = parseAiJson(content); } catch (pe) { return errorResponse({ fn: "bias-detect", code: "upstream_error", message: "AI returned invalid JSON. Please retry.", requestId, cause: pe }); }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return handleFunctionError("bias-detect", e, "Failed to analyze job description", requestId);
    }
  }),
};

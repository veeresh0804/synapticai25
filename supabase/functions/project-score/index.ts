

import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();

    const _body = await safeReqJson(req, "project-score", requestId);
    if (!_body.ok) return _body.response;
    const { github_data, student_name } = _body.value as any;
    if (!github_data) throw new Error("github_data required");
    if (JSON.stringify(github_data).length > 50000) {
      return errorResponse({ fn: "project-score", code: "bad_request", message: "github_data too large (max ~50KB).", requestId });
    }

    const prompt = `You are an AI project scoring engine. Analyze the following GitHub data and score the developer's projects.

Developer: ${student_name || "Unknown"}
GitHub Data:
${JSON.stringify(github_data, null, 2)}

For each notable project/repository, evaluate:
1. Code complexity and architecture quality (based on languages, size, description)
2. Documentation quality (README presence, description)
3. Community engagement (stars, forks, watchers)
4. Technology diversity

Return a JSON object with this EXACT structure:
{
  "overall_score": <number 0-100>,
  "projects": [
    {
      "name": "<repo name>",
      "description": "<brief description>",
      "scores": {
        "architecture": <0-100>,
        "documentation": <0-100>,
        "code_quality": <0-100>,
        "community": <0-100>
      },
      "overall": <0-100>,
      "highlights": ["<highlight1>"],
      "languages": ["<lang1>"]
    }
  ],
  "tech_diversity_score": <0-100>,
  "summary": "<2-3 sentence summary>",
  "top_technologies": ["<tech1>", "<tech2>"]
}

Limit to top 8 projects. Return ONLY valid JSON, no markdown.`;

    const response = await callAI({
      model: "google/gemini-3.6-flash", // TODO: verify model name against Google AI Studio's current model list
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse({ fn: "project-score", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "project-score", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let result: any;
    try { result = parseAiJson(content); } catch (pe) { return errorResponse({ fn: "project-score", code: "upstream_error", message: "AI returned invalid JSON. Please retry.", requestId, cause: pe }); }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return internalError("project-score", e, "Failed to score project", requestId);
    }
  }),
};

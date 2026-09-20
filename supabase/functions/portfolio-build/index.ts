

import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson, handleFunctionError } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();

    const _body = await safeReqJson(req, "portfolio-build", requestId);
    if (!_body.ok) return _body.response;
    const { student_data, profile_data, target_role } = _body.value as any;
    if (!student_data) throw new Error("student_data required");
    if (JSON.stringify(_body.value).length > 50000) {
      return errorResponse({ fn: "portfolio-build", code: "bad_request", message: "Payload too large (max ~50KB).", requestId });
    }

    const prompt = `You are an AI Portfolio Builder. Generate a professional portfolio summary for this student based on their data.

Student Info:
${JSON.stringify(student_data, null, 2)}

Profile Data (GitHub, LeetCode, Skills):
${JSON.stringify(profile_data || {}, null, 2)}

Target Role: ${target_role || "Software Engineer"}

Generate a compelling portfolio with:
1. A professional headline and bio
2. Key skills organized by category
3. Notable projects with descriptions (from GitHub data)
4. Achievements and metrics
5. A professional summary paragraph

Return a JSON object with this EXACT structure:
{
  "headline": "<catchy professional headline>",
  "bio": "<2-3 sentence professional bio>",
  "skills": {
    "languages": ["<skill1>"],
    "frameworks": ["<skill1>"],
    "tools": ["<skill1>"],
    "soft_skills": ["<skill1>"]
  },
  "projects": [
    {
      "name": "<project name>",
      "description": "<compelling 1-2 sentence description>",
      "technologies": ["<tech1>"],
      "highlights": ["<key achievement>"],
      "url": "<github url if available>"
    }
  ],
  "achievements": [
    {"icon": "trophy" | "code" | "star" | "chart", "title": "<achievement>", "detail": "<detail>"}
  ],
  "summary": "<professional summary paragraph for recruiters>",
  "suggested_roles": ["<role1>", "<role2>"],
  "strength_areas": ["<area1>", "<area2>"]
}

Return ONLY valid JSON, no markdown.`;

    const response = await callAI({
      model: "google/gemini-3.5-flash-lite", // TODO: verify model name against Google AI Studio's current model list
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse({ fn: "portfolio-build", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "portfolio-build", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let result: any;
    try { result = parseAiJson(content); } catch (pe) { return errorResponse({ fn: "portfolio-build", code: "upstream_error", message: "AI returned invalid JSON. Please retry.", requestId, cause: pe }); }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return handleFunctionError("portfolio-build", e, "Failed to build portfolio", requestId);
    }
  }),
};

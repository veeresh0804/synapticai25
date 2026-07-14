

import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {

    const { student_profile } = await req.json();
    if (!student_profile) throw new Error("student_profile required");

    const prompt = `You are a resume authenticity detector. Analyze the following student profile data for signs of inflated or fake credentials.

Profile Data:
${JSON.stringify(student_profile, null, 2)}

Analyze these signals:
1. GitHub: Check if repos are mostly forks with minimal commits, low code activity relative to claimed skills, suspicious patterns
2. LeetCode: Check if problem count matches claimed skill level, activity timeline gaps
3. Resume Skills: Check if claimed skills are consistent with GitHub languages and project types
4. Overall consistency between platforms

Return a JSON object with this EXACT structure:
{
  "authenticity_score": <number 0-100>,
  "risk_level": "low" | "medium" | "high",
  "signals": [
    {"type": "positive" | "warning" | "suspicious", "category": "github" | "leetcode" | "resume" | "consistency", "message": "<description>"}
  ],
  "summary": "<2-3 sentence summary>",
  "recommendations": ["<recommendation1>", "<recommendation2>"]
}

Return ONLY valid JSON, no markdown.`;

    const response = await callAI({
      model: "google/gemini-2.0-flash", // TODO: verify model name against Google AI Studio's current model list
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse({ fn: "authenticity-check", code: "rate_limited", message: "Rate limited, try again later.", requestId });
      if (status === 402) return errorResponse({ fn: "authenticity-check", code: "payment_required", message: "Payment required.", requestId });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return internalError("authenticity-check", e, "Failed to verify authenticity", requestId);
    }
  }),
};

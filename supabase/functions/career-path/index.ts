import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
      const userId = ctx.userClaims?.sub || ctx.userClaims?.id;
      const adminClient = ctx.supabaseAdmin;

    const { target_role } = await req.json();
    if (!target_role) throw new Error("target_role is required");

    const { data: student } = await adminClient.from("students").select("*").eq("user_id", userId).maybeSingle();
    if (!student) throw new Error("Student profile not found");

    const { data: profile } = await adminClient.from("student_profiles").select("*").eq("student_id", student.id).maybeSingle();

    const studentContext = {
      name: student.name,
      degree: student.degree,
      branch: student.branch,
      institution: student.institution,
      graduation_year: student.graduation_year,
      gemini_analysis: profile?.gemini_analysis || null,
      resume_skills: profile?.resume_skills || null,
      github_data: profile?.github_data || null,
      leetcode_data: profile?.leetcode_data || null,
    };

    const aiResponse = await callAI({
      model: "google/gemini-2.0-flash", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        { role: "system", content: "You are an expert career advisor and tech mentor. Create personalized, actionable career roadmaps." },
        {
          role: "user",
          content: `Create a detailed career path for this student targeting the role: "${target_role}"

Student Profile:
${JSON.stringify(studentContext, null, 2)}

Create a personalized 6-month roadmap with specific monthly goals, resources, and milestones.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_career_path",
            description: "Return a structured career roadmap",
            parameters: {
              type: "object",
              properties: {
                target_role: { type: "string" },
                current_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                readiness_score: { type: "number", description: "0-100 how ready the student is for this role" },
                summary: { type: "string", description: "2-3 sentence assessment of their current position relative to the target role" },
                skill_gaps: { type: "array", items: { type: "string" }, description: "Skills they need to develop" },
                roadmap: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      month: { type: "integer", description: "Month index 1-6" },
                      focus: { type: "string", description: "Monthly focus area" },
                      topics: { type: "array", items: { type: "string" } },
                      resources: { type: "array", items: { type: "string" } },
                      milestones: { type: "array", items: { type: "string" } },
                    },
                    required: ["month", "focus", "topics", "resources", "milestones"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["target_role", "current_level", "readiness_score", "summary", "skill_gaps", "roadmap"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_career_path" } },
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return errorResponse({ fn: "career-path", code: "rate_limited", message: "Rate limit exceeded.", requestId });
      if (status === 402) return errorResponse({ fn: "career-path", code: "payment_required", message: "AI credits exhausted.", requestId });
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("AI did not return structured output");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return internalError("career-path", e, "Failed to generate career path", requestId);
    }
  }),
};

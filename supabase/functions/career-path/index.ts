import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson, handleFunctionError } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();
      const userId = ctx.userClaims?.sub || ctx.userClaims?.id;
      const adminClient = ctx.supabaseAdmin;

    const _body = await safeReqJson(req, "career-path", requestId);
    if (!_body.ok) return _body.response;
    const { target_role, targetRole } = _body.value as any;
    const target_role_val = target_role || targetRole;
    if (!target_role_val) throw new Error("target_role is required");

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
      model: "google/gemini-3.5-flash-lite", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        { role: "system", content: "You are an expert career advisor and tech mentor. Create personalized, actionable career roadmaps." },
        {
          role: "user",
          content: `Create a detailed career path for this student targeting the role: "${target_role_val}"

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
                existing_strengths: { type: "array", items: { type: "string" }, description: "Skills the student already has" },
                skill_gaps: { type: "array", items: { type: "string" }, description: "Skills they need to develop" },
                monthly_plan: {
                  type: "array",
                  description: "6 entries, one per month. Never return empty.",
                  items: {
                    type: "object",
                    properties: {
                      month: { type: "integer", description: "Month index 1-6" },
                      title: { type: "string", description: "Monthly focus area, e.g. Backend Foundations" },
                      goals: { type: "array", items: { type: "string" }, description: "3-4 concrete goals for the month" },
                      resources: { type: "array", items: { type: "string" }, description: "2-3 courses/docs with names" },
                      project_idea: { type: "string", description: "One portfolio project to ship that month" },
                    },
                    required: ["month", "title", "goals", "resources", "project_idea"],
                  },
                },
                recommended_certifications: { type: "array", items: { type: "string" } },
                interview_tips: { type: "array", items: { type: "string" }, description: "3-5 interview tips for the target role" },
              },
              required: ["target_role", "current_level", "readiness_score", "summary", "existing_strengths", "skill_gaps", "monthly_plan", "recommended_certifications", "interview_tips"],
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

    const raw = (() => { try { return parseAiJson(toolCall.function.arguments); } catch (pe) { throw new Error("AI returned invalid structured output. Please retry."); } })() as any;

    // Normalize both old edge shape (roadmap/focus/topics/milestones) and new shape
    // so the frontend never crashes to a blank screen.
    const strArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const legacy = Array.isArray(raw.roadmap) ? raw.roadmap : [];
    let monthly_plan = Array.isArray(raw.monthly_plan) ? raw.monthly_plan : [];
    if (monthly_plan.length === 0 && legacy.length > 0) {
      monthly_plan = legacy.slice(0, 6).map((m: any, idx: number) => ({
        month: typeof m.month === "number" ? m.month : idx + 1,
        title: String(m.title || m.focus || `Month ${idx + 1}`),
        goals: strArr(m.goals ?? m.topics ?? m.milestones).slice(0, 4),
        resources: strArr(m.resources).slice(0, 3),
        project_idea: String(m.project_idea || (Array.isArray(m.milestones) ? m.milestones[0] : "") || `Build a project applying ${m.focus || "this month's focus"}.`),
      }));
    }
    monthly_plan = monthly_plan.slice(0, 6).map((m: any, idx: number) => ({
      month: typeof m.month === "number" ? m.month : idx + 1,
      title: String(m.title || m.focus || `Month ${idx + 1}`),
      goals: (strArr(m.goals ?? m.topics ?? m.milestones).length > 0
        ? strArr(m.goals ?? m.topics ?? m.milestones)
        : [`Focus on ${String(m.title || m.focus || "core skills")}`]).slice(0, 4),
      resources: strArr(m.resources).slice(0, 3),
      project_idea: String(m.project_idea || "Build a portfolio project and push it to GitHub."),
    }));

    const result = {
      target_role: String(raw.target_role || raw.targetRole || target_role_val),
      current_level: String(raw.current_level || "beginner"),
      readiness_score: typeof raw.readiness_score === "number" ? raw.readiness_score : Number(raw.readiness_score) || 0,
      summary: String(raw.summary || "Personalized roadmap generated from your profile."),
      existing_strengths: strArr(raw.existing_strengths ?? raw.strengths),
      skill_gaps: strArr(raw.skill_gaps),
      monthly_plan,
      recommended_certifications: strArr(raw.recommended_certifications),
      interview_tips: strArr(raw.interview_tips ?? raw.tips),
    };
    if (result.monthly_plan.length === 0) throw new Error("AI returned empty roadmap. Please retry.");
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return handleFunctionError("career-path", e, "Failed to generate career path", requestId);
    }
  }),
};


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

    const _body = await safeReqJson(req, "eligibility-check", requestId);
    if (!_body.ok) return _body.response;
    const { job_id, jobId } = _body.value as any;
    const job_id_val = job_id || jobId;
    if (!job_id_val) throw new Error("job_id is required");

    const { data: student } = await adminClient.from("students").select("*").eq("user_id", userId).maybeSingle();
    if (!student) throw new Error("Student profile not found");

    // Fetch student_profiles (extracted data)
    const { data: profile } = await adminClient
      .from("student_profiles")
      .select("*")
      .eq("student_id", student.id)
      .maybeSingle();

    // Fetch job
    const { data: job } = await adminClient
      .from("jobs")
      .select("*")
      .eq("id", job_id_val)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    const studentSummary = {
      name: student.name,
      institution: student.institution,
      degree: student.degree,
      branch: student.branch,
      graduation_year: student.graduation_year,
      github_url: profile?.github_url || null,
      github_data: profile?.github_data || null,
      leetcode_url: profile?.leetcode_url || null,
      leetcode_data: profile?.leetcode_data || null,
      linkedin_url: profile?.linkedin_url || null,
      linkedin_data: profile?.linkedin_data || null,
    };

    const prompt = `You are an expert career advisor AI. Analyze how well this student matches the following job posting and provide a detailed eligibility analysis with a personalized learning roadmap focused on maximizing SHORTLIST chances.

JOB DETAILS:
- Title: ${job.title}
- Description: ${job.description}
- Required Skills: ${(job.required_skills || []).join(", ")}
- Preferred Skills: ${(job.preferred_skills || []).join(", ")}
- Experience Required: ${job.experience_required || "Not specified"}
- Job Type: ${job.job_type}

STUDENT PROFILE:
${JSON.stringify(studentSummary, null, 2)}

Provide:
1. An overall match percentage (0-100)
2. Skills the student already has that match
3. Skills the student is missing (ordered by importance for shortlisting)
4. A personalized learning roadmap with specific resources and timelines to fill skill gaps.
   For EACH missing skill (max 5), return: skill name, priority (high for must-have screening skills, medium for preferred, low for nice-to-have), timeline like "2 weeks", a 1-2 sentence description of WHY recruiters screen for it and HOW to prove it, 2 concrete learning resources WITH REAL WORKING URLs (official docs, free courses), and one concrete shortlist-booster project action (e.g. "Build and deploy X, add README + demo link to resume").
5. A brief eligibility verdict + 3-5 actionable tips that directly increase shortlist odds (projects to ship, resume bullets, GitHub proof).`;

    const aiResponse = await callAI({
      model: "google/gemini-3.5-flash-lite", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        { role: "system", content: "You are an expert career advisor that helps students understand their job eligibility and provides actionable learning paths." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "eligibility_analysis",
            description: "Return structured eligibility analysis with match score and roadmap",
            parameters: {
              type: "object",
              properties: {
                match_percentage: { type: "number", description: "0-100 overall match score" },
                verdict: { type: "string", description: "Brief eligibility verdict (e.g., Strong Match, Moderate Match, Needs Development)" },
                verdict_detail: { type: "string", description: "2-3 sentence explanation of the verdict" },
                matched_skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "Skills the student already has that match the job",
                },
                missing_skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "Skills the student needs to develop",
                },
                roadmap: {
                  type: "array",
                  description: "One entry per missing skill, highest priority first. Never return an empty array when missing_skills is non-empty.",
                  items: {
                    type: "object",
                    properties: {
                      skill: { type: "string", description: "Skill or topic area to learn, e.g. Node.js" },
                      priority: { type: "string", description: "high, medium, or low — how much this blocks shortlisting" },
                      timeline: { type: "string", description: "Suggested study duration (e.g., 2 weeks, 3 weeks)" },
                      description: { type: "string", description: "1-2 sentences: why recruiters screen for this and how to prove it" },
                      action: { type: "string", description: "One concrete shortlist-booster project action with deliverable" },
                      resources: {
                        type: "array",
                        description: "2 specific learning resources with real URLs",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string", description: "Resource name, e.g. Node.js Official Docs" },
                            url: { type: "string", description: "Real working https URL" },
                            type: { type: "string", description: "docs, course, video, project, or practice" },
                          },
                          required: ["title", "type"],
                        },
                      },
                    },
                    required: ["skill", "priority", "timeline", "description", "resources", "action"],
                  },
                },
                tips: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 actionable tips to improve candidacy",
                },
              },
              required: ["match_percentage", "verdict", "verdict_detail", "matched_skills", "missing_skills", "roadmap", "tips"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "eligibility_analysis" } },
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) {
        return errorResponse({ fn: "eligibility-check", code: "rate_limited", message: "Rate limit exceeded, please try again later.", requestId });
      }
      if (status === 402) {
        return errorResponse({ fn: "eligibility-check", code: "payment_required", message: "AI credits exhausted. Please add funds.", requestId });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: any;
    if (toolCall?.function?.arguments) {
      analysis = (() => { try { return parseAiJson(toolCall.function.arguments); } catch (pe) { throw new Error("AI returned invalid structured output. Please retry."); } })();
    } else {
      throw new Error("AI did not return structured analysis");
    }

    // Normalize: accept old shape ({topic, resources: string[]}) and new shape,
    // guarantee the frontend never receives blank roadmap entries.
    const missing: string[] = Array.isArray(analysis.missing_skills) ? analysis.missing_skills.filter(Boolean) : [];
    const rawRoadmap = Array.isArray(analysis.roadmap) ? analysis.roadmap : [];
    const roadmap = rawRoadmap.slice(0, 5).map((it: any, idx: number) => {
      const skill = String(it?.skill || it?.topic || missing[idx] || `Skill gap ${idx + 1}`).trim();
      const p = String(it?.priority || (idx === 0 ? "high" : idx === 1 ? "medium" : "low")).toLowerCase();
      const priority = p === "high" || p === "medium" || p === "low" ? p : "medium";
      const timeline = String(it?.timeline || it?.duration || (priority === "high" ? "3 weeks" : "2 weeks"));
      const description = String(
        it?.description || it?.detail ||
        `Build production-level ${skill} to clear recruiter screening and lift shortlist chances.`,
      );
      const action = String(
        it?.action || it?.project_idea ||
        `Ship a small ${skill} project with README + live demo and link it on your resume.`,
      );
      const rawRes = Array.isArray(it?.resources) ? it.resources : [];
      const resources = rawRes.slice(0, 3).map((r: any) => {
        if (typeof r === "string") return { title: r, type: "resource" };
        return { title: String(r?.title || skill), url: r?.url, type: String(r?.type || "resource") };
      }).filter((r: any) => r.title);
      return { skill, priority, timeline, description, action, resources };
    });
    // If AI returned empty roadmap but we have missing skills, synthesize entries
    // so the student always gets shortlist guidance.
    if (roadmap.length === 0 && missing.length > 0) {
      missing.slice(0, 5).forEach((skill: string, idx: number) => {
        roadmap.push({
          skill,
          priority: idx === 0 ? "high" : idx === 1 ? "medium" : "low",
          timeline: idx === 0 ? "3 weeks" : "2 weeks",
          description: `Recruiters for this role filter on ${skill}. Close this gap first to move from screening to shortlist.`,
          action: `Ship a small ${skill} project with README + live demo and link it on your resume.`,
          resources: [],
        });
      });
    }
    analysis.roadmap = roadmap;
    if (!Array.isArray(analysis.matched_skills)) analysis.matched_skills = [];
    if (!Array.isArray(analysis.missing_skills)) analysis.missing_skills = missing;
    if (!Array.isArray(analysis.tips)) analysis.tips = [];

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return handleFunctionError("eligibility-check", e, "Failed to check eligibility", requestId);
    }
  }),
};


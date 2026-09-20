import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson, parseAiJson } from "../_shared/http.ts";
import { callAI } from "../_shared/ai.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
    if (isOptions(req)) return optionsResponse();
      const userId = ctx.userClaims?.sub || ctx.userClaims?.id;
      const adminClient = ctx.supabaseAdmin;

    const { data: student } = await adminClient
      .from("students")
      .select("id, name, resume_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (!student) throw new Error("Student profile not found");
    if (!student.resume_url) throw new Error("No resume uploaded. Please upload your resume first.");

    // Download resume from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("resumes")
      .download(student.resume_url);
    if (downloadError || !fileData) throw new Error("Failed to download resume: " + (downloadError?.message || "Unknown error"));

    // Convert file to base64 for AI processing (chunked to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);
    const mimeType = student.resume_url.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";

    // Send to AI for skill extraction using multimodal (PDF as inline_data)
    const aiResponse = await callAI({
      model: "google/gemini-3.6-flash", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        {
          role: "system",
          content: "You are an expert resume parser and technical recruiter. Extract all skills, technologies, certifications, and relevant experience from the resume document provided.",
        },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: student.resume_url.split("/").pop() || "resume.pdf",
                file_data: `data:${mimeType};base64,${base64Content}`,
              },
            },
            {
              type: "text",
              text: "Parse this resume and extract all relevant information. Identify technical skills, soft skills, certifications, education details, work experience, and project highlights.",
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_resume_skills",
            description: "Return structured resume analysis with extracted skills and experience",
            parameters: {
              type: "object",
              properties: {
                technical_skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "Programming languages, frameworks, tools, databases, cloud platforms",
                },
                soft_skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "Communication, leadership, teamwork, etc.",
                },
                certifications: {
                  type: "array",
                  items: { type: "string" },
                  description: "Professional certifications mentioned",
                },
                experience_summary: {
                  type: "string",
                  description: "Brief 2-3 sentence summary of work experience",
                },
                projects: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      technologies: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "description", "technologies"],
                    additionalProperties: false,
                  },
                  description: "Key projects mentioned in the resume",
                },
                skill_categories: {
                  type: "object",
                  properties: {
                    languages: { type: "array", items: { type: "string" } },
                    frameworks: { type: "array", items: { type: "string" } },
                    databases: { type: "array", items: { type: "string" } },
                    devops: { type: "array", items: { type: "string" } },
                    other: { type: "array", items: { type: "string" } },
                  },
                  required: ["languages", "frameworks", "databases", "devops", "other"],
                  additionalProperties: false,
                },
                overall_experience_level: {
                  type: "string",
                  enum: ["fresher", "junior", "mid-level", "senior"],
                },
                resume_score: {
                  type: "number",
                  description: "0-100 resume quality score based on content, formatting, and completeness",
                },
              },
              required: [
                "technical_skills",
                "soft_skills",
                "certifications",
                "experience_summary",
                "projects",
                "skill_categories",
                "overall_experience_level",
                "resume_score",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_resume_skills" } },
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) {
        return errorResponse({ fn: "parse-resume", code: "rate_limited", message: "Rate limit exceeded, please try again later.", requestId });
      }
      if (status === 402) {
        return errorResponse({ fn: "parse-resume", code: "payment_required", message: "AI credits exhausted.", requestId });
      }
      throw new Error("AI resume parsing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let resumeSkills;
    if (toolCall?.function?.arguments) {
      resumeSkills = (() => { try { return parseAiJson(toolCall.function.arguments); } catch (pe) { throw new Error("AI returned invalid structured output. Please retry."); } })();
    } else {
      throw new Error("AI did not return structured resume analysis");
    }

    // Store extracted skills in student_profiles
    await adminClient
      .from("student_profiles")
      .update({ resume_skills: resumeSkills })
      .eq("student_id", student.id);

    return new Response(
      JSON.stringify({ resume_skills: resumeSkills }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    } catch (e) {
      return internalError("parse-resume", e, "Failed to parse resume", requestId);
    }
  }),
};

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

    // Discard any body (we never trust caller-supplied user_id)
    try { await req.json(); } catch {}

    const { data: student } = await adminClient
      .from("students")
      .select("id, name, degree, branch, institution, graduation_year")
      .eq("user_id", userId)
      .maybeSingle();
    if (!student) throw new Error("No student profile found");

    // Get student_profiles record for URLs
    const { data: profile } = await adminClient
      .from("student_profiles")
      .select("*")
      .eq("student_id", student.id)
      .maybeSingle();
    if (!profile) throw new Error("Student profile links not found. Please save your profile first.");

    // --- URL Validation (SSRF Prevention) ---
    const ALLOWED_DOMAINS: Record<string, string[]> = {
      github: ["github.com", "www.github.com"],
      leetcode: ["leetcode.com", "www.leetcode.com"],
      linkedin: ["linkedin.com", "www.linkedin.com", "in.linkedin.com"],
    };

    function isValidProfileUrl(url: string, allowedDomains: string[]): boolean {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        return allowedDomains.some((d) => parsed.hostname === d);
      } catch {
        return false;
      }
    }

    const githubUrl = profile.github_url;
    const leetcodeUrl = profile.leetcode_url;

    // --- GitHub Extraction ---
    let githubData: any = null;
    if (githubUrl && isValidProfileUrl(githubUrl, ALLOWED_DOMAINS.github)) {
      const username = githubUrl.replace(/\/$/, "").split("/").pop();
      if (username) {
        try {
          // Fetch user profile
          const userRes = await fetch(`https://api.github.com/users/${username}`, {
            headers: { "User-Agent": "SynapticAI-Bot", Accept: "application/vnd.github.v3+json" },
          });
          if (userRes.ok) {
            const userData = await userRes.json();

            // Fetch repos (top 30 by stars)
            const reposRes = await fetch(
              `https://api.github.com/users/${username}/repos?sort=stars&per_page=30&type=owner`,
              { headers: { "User-Agent": "SynapticAI-Bot", Accept: "application/vnd.github.v3+json" } }
            );
            const repos = reposRes.ok ? await reposRes.json() : [];

            // Compute language stats
            const languageCounts: Record<string, number> = {};
            for (const repo of repos) {
              if (repo.language) {
                languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
              }
            }

            const topRepos = repos.slice(0, 10).map((r: any) => ({
              name: r.name,
              description: r.description,
              stars: r.stargazers_count,
              forks: r.forks_count,
              language: r.language,
              url: r.html_url,
              updated_at: r.updated_at,
            }));

            githubData = {
              username: userData.login,
              name: userData.name,
              bio: userData.bio,
              public_repos: userData.public_repos,
              followers: userData.followers,
              following: userData.following,
              created_at: userData.created_at,
              languages: languageCounts,
              top_repos: topRepos,
              total_stars: repos.reduce((sum: number, r: any) => sum + r.stargazers_count, 0),
              total_forks: repos.reduce((sum: number, r: any) => sum + r.forks_count, 0),
            };
          }
        } catch (e) {
          console.error("GitHub fetch error:", e);
        }
      }
    }

    // --- LeetCode Extraction ---
    let leetcodeData: any = null;
    if (leetcodeUrl && isValidProfileUrl(leetcodeUrl, ALLOWED_DOMAINS.leetcode)) {
      const username = leetcodeUrl.replace(/\/$/, "").split("/").pop();
      if (username) {
        try {
          const lcRes = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "SynapticAI-Bot" },
            body: JSON.stringify({
              query: `query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                  username
                  submitStats: submitStatsGlobal {
                    acSubmissionNum { difficulty count }
                  }
                  profile { ranking reputation }
                  badges { name }
                }
              }`,
              variables: { username },
            }),
          });
          if (lcRes.ok) {
            const lcJson = await lcRes.json();
            const matched = lcJson.data?.matchedUser;
            if (matched) {
              const stats = matched.submitStats?.acSubmissionNum || [];
              leetcodeData = {
                username: matched.username,
                ranking: matched.profile?.ranking,
                reputation: matched.profile?.reputation,
                solved: {
                  all: stats.find((s: any) => s.difficulty === "All")?.count || 0,
                  easy: stats.find((s: any) => s.difficulty === "Easy")?.count || 0,
                  medium: stats.find((s: any) => s.difficulty === "Medium")?.count || 0,
                  hard: stats.find((s: any) => s.difficulty === "Hard")?.count || 0,
                },
                badges: (matched.badges || []).map((b: any) => b.name),
              };
            }
          }
        } catch (e) {
          console.error("LeetCode fetch error:", e);
        }
      }
    }

    // --- AI Analysis ---
    const profileSummary = {
      student: { name: student.name, degree: student.degree, branch: student.branch, institution: student.institution, graduation_year: student.graduation_year },
      github: githubData,
      leetcode: leetcodeData,
      linkedin_url: profile.linkedin_url,
    };

    const aiResponse = await callAI({
      model: "google/gemini-3.5-flash-lite", // TODO: verify model name against Google AI Studio's current model list
      messages: [
        { role: "system", content: "You are an expert technical career analyst. Analyze student developer profiles and provide actionable insights." },
        {
          role: "user",
          content: `Analyze this student developer profile and provide a comprehensive assessment:\n\n${JSON.stringify(profileSummary, null, 2)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "profile_analysis",
            description: "Return structured profile analysis",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "number", description: "0-100 overall developer readiness score" },
                summary: { type: "string", description: "2-3 sentence overall assessment" },
                technical_skills: { type: "array", items: { type: "string" }, description: "Identified technical skills" },
                skill_level: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert"] },
                strengths: { type: "array", items: { type: "string" } },
                areas_to_improve: { type: "array", items: { type: "string" } },
                recommended_roles: { type: "array", items: { type: "string" }, description: "Job roles this student would be good for" },
                github_assessment: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    highlights: { type: "array", items: { type: "string" } },
                  },
                  required: ["score", "highlights"],
                  additionalProperties: false,
                },
                leetcode_assessment: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    highlights: { type: "array", items: { type: "string" } },
                  },
                  required: ["score", "highlights"],
                  additionalProperties: false,
                },
              },
              required: ["overall_score", "summary", "technical_skills", "skill_level", "strengths", "areas_to_improve", "recommended_roles", "github_assessment", "leetcode_assessment"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "profile_analysis" } },
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) {
        return errorResponse({ fn: "extract-profile", code: "rate_limited", message: "Rate limit exceeded, please try again later.", requestId });
      }
      if (status === 402) {
        return errorResponse({ fn: "extract-profile", code: "payment_required", message: "AI credits exhausted.", requestId });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = (() => { try { return parseAiJson(toolCall.function.arguments); } catch (pe) { throw new Error("AI returned invalid structured output. Please retry."); } })();
    } else {
      throw new Error("AI did not return structured analysis");
    }

    // Store extracted data and analysis
    await adminClient
      .from("student_profiles")
      .update({
        github_data: githubData || {},
        leetcode_data: leetcodeData || {},
        gemini_analysis: analysis,
        last_extracted_at: new Date().toISOString(),
      })
      .eq("student_id", student.id);

    return new Response(
      JSON.stringify({ github_data: githubData, leetcode_data: leetcodeData, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    } catch (e) {
      return handleFunctionError("extract-profile", e, "Failed to extract profile", requestId);
    }
  }),
};

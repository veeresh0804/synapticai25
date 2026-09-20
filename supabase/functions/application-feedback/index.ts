import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { isOptions, optionsResponse, safeReqJson } from "../_shared/http.ts";
import { withSupabase } from "npm:@supabase/server";

// Recruiter-only read path for the sensitive recruiter_feedback column.
// There is intentionally NO view exposing match_analysis/recruiter_feedback
// (keeps the SECURITY DEFINER lint clean); callers prove ownership here.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
      if (isOptions(req)) return optionsResponse();

      const userId = ctx.userClaims?.sub || ctx.userClaims?.id;
      if (!userId) {
        return errorResponse({ fn: "application-feedback", code: "unauthorized", message: "Sign in required.", requestId });
      }
      const adminClient = ctx.supabaseAdmin;

      const parsed = await safeReqJson(req, "application-feedback", requestId);
      if (!parsed.ok) return parsed.response;
      const { application_ids } = parsed.value as any;
      if (!Array.isArray(application_ids) || application_ids.length === 0 || application_ids.length > 100) {
        return errorResponse({ fn: "application-feedback", code: "bad_request", message: "application_ids must be an array of 1-100 ids.", requestId });
      }
      for (const id of application_ids) {
        if (typeof id !== "string" || id.length > 40) {
          return errorResponse({ fn: "application-feedback", code: "bad_request", message: "Invalid application id.", requestId });
        }
      }

      const { data: recruiter } = await adminClient
        .from("recruiters").select("id").eq("user_id", userId).maybeSingle();
      if (!recruiter) {
        return errorResponse({ fn: "application-feedback", code: "forbidden", message: "Recruiter profile required.", requestId });
      }

      const { data: apps, error: appsError } = await adminClient
        .from("applications").select("id, job_id, recruiter_feedback").in("id", application_ids);
      if (appsError) throw new Error("Failed to load applications");

      const jobIds = [...new Set((apps || []).map((a: any) => a.job_id))];
      const { data: jobs } = await adminClient.from("jobs").select("id, recruiter_id").in("id", jobIds);
      const ownedJobIds = new Set(
        (jobs || []).filter((j: any) => j.recruiter_id === recruiter.id).map((j: any) => j.id),
      );

      const feedback = (apps || [])
        .filter((a: any) => ownedJobIds.has(a.job_id))
        .map((a: any) => ({ id: a.id, recruiter_feedback: a.recruiter_feedback ?? null }));

      return new Response(JSON.stringify({ feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
      });
    } catch (e) {
      return internalError("application-feedback", e, "Failed to load feedback", requestId);
    }
  }),
};

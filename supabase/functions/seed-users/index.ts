import { corsHeaders, errorResponse, internalError, newRequestId } from "../_shared/errors.ts";
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const requestId = newRequestId();

    try {
      // Require a pre-shared seed secret. Without SEED_SECRET configured,
      // the function is permanently disabled.
      const seedSecret = Deno.env.get("SEED_SECRET");
      const provided = req.headers.get("x-seed-secret");
      if (!seedSecret || !provided || provided !== seedSecret) {
        return errorResponse({ fn: "seed-users", code: "unauthorized", message: "Not authorized.", requestId });
      }

      const admin = ctx.supabaseAdmin;

    const demoPassword = "Demo@1234";

    const accounts = [
      // 3 Students
      { email: "aarav.kumar86@iit.ac.in", role: "student", table: "students", nameField: "name", nameMatch: "Aarav Kumar" },
      { email: "aditi.chatterjee85@iit.ac.in", role: "student", table: "students", nameField: "name", nameMatch: "Aditi Chatterjee" },
      { email: "aditya.patel24@iit.ac.in", role: "student", table: "students", nameField: "name", nameMatch: "Aditya Patel" },
      // 3 Recruiters
      { email: "priya.sharma@tcs.com", role: "recruiter", table: "recruiters", nameField: "recruiter_name", nameMatch: "Priya Sharma" },
      { email: "sneha.kapoor@zomato.com", role: "recruiter", table: "recruiters", nameField: "recruiter_name", nameMatch: "Sneha Kapoor" },
      { email: "rahul.verma@synapticai.com", role: "recruiter", table: "recruiters", nameField: "recruiter_name", nameMatch: "Rahul Verma" },
      // 1 Admin
      { email: "admin@hirehub.com", role: "admin", table: null, nameField: null, nameMatch: null },
    ];

    const results = [];

    for (const acct of accounts) {
      const { data: userData, error: createError } = await admin.auth.admin.createUser({
        email: acct.email,
        password: demoPassword,
        email_confirm: true,
      });

      if (createError) {
        results.push({ email: acct.email, status: "skipped", error: createError.message });
        continue;
      }

      const userId = userData.user.id;

      // Assign role
      await admin.from("user_roles").insert({ user_id: userId, role: acct.role });

      // Link to existing profile record
      if (acct.table && acct.nameMatch && acct.nameField) {
        const { error: updateError } = await admin.from(acct.table)
          .update({ user_id: userId })
          .eq(acct.nameField, acct.nameMatch);
        
        if (updateError) {
          results.push({ email: acct.email, status: "created_no_link", userId, error: updateError.message });
          continue;
        }
      }

      results.push({ email: acct.email, status: "created", userId });
    }

    return new Response(JSON.stringify({ results, password: demoPassword }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (e) {
      return internalError("seed-users", e, "Failed to seed users", requestId);
    }
  }),
};

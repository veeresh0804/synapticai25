// Shared HTTP helpers: CORS preflight + safe JSON parsing for edge functions.
import { corsHeaders, errorResponse } from "./errors.ts";

export function optionsResponse(): Response {
  return new Response("ok", { headers: { ...corsHeaders } });
}

export function isOptions(req: Request): boolean {
  return req.method === "OPTIONS";
}

/** Safely parse request JSON. Returns {ok, value} or sends 400 response via onError. */
export async function safeReqJson<T = any>(
  req: Request,
  fn: string,
  requestId: string,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let value: T;
  try {
    value = (await req.json()) as T;
  } catch (_e) {
    return {
      ok: false,
      response: errorResponse({
        fn,
        code: "bad_request",
        message: "Invalid JSON body.",
        requestId,
      }),
    };
  }
  if (value === null || typeof value !== "object") {
    return {
      ok: false,
      response: errorResponse({
        fn,
        code: "bad_request",
        message: "JSON body must be an object.",
        requestId,
      }),
    };
  }
  return { ok: true, value };
}

/**
 * Extract JSON from model output that may contain fences, leading prose,
 * or trailing explanation. Throws on failure so callers map to upstream_error.
 */
export function parseAiJson(raw: string): any {
  const text = (raw || "").trim();
  if (!text) throw new Error("Empty model output");
  // Fast path: whole string is JSON
  try {
    return JSON.parse(text);
  } catch { /* fall through to extraction */ }
  // Strip markdown fences (any case, anywhere) then extract first {...} or [...]
  const noFences = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(noFences);
  } catch { /* fall through */ }
  const startObj = noFences.indexOf("{");
  const startArr = noFences.indexOf("[");
  let start = -1;
  let endChar = "";
  if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
    start = startObj;
    endChar = "}";
  } else if (startArr !== -1) {
    start = startArr;
    endChar = "]";
  }
  if (start === -1) throw new Error("No JSON found in model output");
  const end = noFences.lastIndexOf(endChar);
  if (end <= start) throw new Error("Truncated JSON in model output");
  return JSON.parse(noFences.slice(start, end + 1));
}

/** Wrap withSupabase handler with pre-auth OPTIONS short-circuit. */
export function withOptions(
  authedFetch: (req: Request, ctx: any) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: any): Promise<Response> => {
    if (isOptions(req)) return optionsResponse();
    return await authedFetch(req, ctx);
  };
}

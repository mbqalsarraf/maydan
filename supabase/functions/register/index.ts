// Pilot registration: creates an email/password account without an email round-trip so judges can
// register immediately. Email ownership is NOT verified (disclosed in the UI). Throttled per network.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { email?: unknown; password?: unknown; display_name?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_request" }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "invalid_email" });
  if (password.length < 8 || password.length > 200) return json({ error: "weak_password" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("maydan:" + ip));
  const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const [mine, all] = await Promise.all([
    admin.from("signup_attempts").select("*", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", since),
    admin.from("signup_attempts").select("*", { count: "exact", head: true }).gte("at", since),
  ]);
  if ((mine.count ?? 0) >= 15 || (all.count ?? 0) >= 300) return json({ error: "rate_limited" });
  await admin.from("signup_attempts").insert({ ip_hash: ipHash });

  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName },
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return json({ error: taken ? "email_taken" : "failed" });
  }
  return json({ ok: true });
});

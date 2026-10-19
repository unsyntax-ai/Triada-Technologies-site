// Supabase Edge Function: draft-job
// Turns rough notes into a clean job listing using Groq. Only the admin can call it.
// The Groq key is read from the secret GROQ_API_KEY and never reaches the browser.

const ADMIN_EMAIL = "cvmaster.ops@gmail.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://evofqeolhdlteyztrzin.supabase.co";
const MODEL = "llama-3.3-70b-versatile"; // change here if Groq retires this model
const TYPES = ["Contract", "Contract-to-hire", "Direct hire", "Temporary"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const SYSTEM = `You write job listings for TriadaTechnologies, a nationwide U.S. staffing firm.
Turn the recruiter's rough notes into a clear, honest listing. Rules:
- Use only facts found in the notes. Never invent pay, benefits, perks, years of experience, tools or a client name. If something is not in the notes, leave it out.
- Do not add citizenship, visa, age, gender or any other restriction unless the notes state it. Keep wording neutral and inclusive.
- Plain, friendly, specific language. No buzzwords, no hype, no em dashes.
- "summary": 2 to 3 sentences about the role and who it suits.
- "responsibilities": 4 to 8 short items. "requirements": 3 to 8 short items.
- "employment_type" must be exactly one of: ${TYPES.join(", ")}. Pick the closest to the notes; if unclear use "Contract".
- "location": city and state, or "Remote (U.S.)", or "Hybrid, City, ST", based on the notes. If unclear, use "Remote (U.S.)" and mention it in "confirm".
- "pay": only if the notes give it, otherwise an empty string.
- "confirm": a short list of things the recruiter should double check before publishing (missing pay, unclear location, unclear contract length, anything you guessed).
Return one JSON object with exactly these keys: title, location, employment_type, pay, summary, responsibilities, requirements, confirm.`;

const asList = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  // 1. Only the signed-in admin may use this.
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!who.ok) return reply({ error: "Please sign in again." }, 401);
  const user = await who.json();
  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) return reply({ error: "Not allowed." }, 403);

  // 2. Read the notes.
  let notes = "";
  try { notes = String((await req.json()).notes ?? "").trim(); } catch { /* fall through */ }
  if (notes.length < 20) return reply({ error: "Add a few more details about the role." }, 400);
  if (notes.length > 6000) return reply({ error: "Notes are too long. Keep them under 6000 characters." }, 400);

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) return reply({ error: "The Groq key is not set in Supabase secrets." }, 500);

  // 3. Ask Groq for a draft.
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Recruiter notes:\n${notes}` }],
    }),
  });
  if (!r.ok) return reply({ error: `The AI service returned an error (${r.status}).` }, 502);

  let d: Record<string, unknown>;
  try {
    d = JSON.parse((await r.json()).choices[0].message.content);
  } catch {
    return reply({ error: "The AI draft could not be read. Try again." }, 502);
  }

  // 4. Clean the draft so the form always gets safe, expected shapes.
  const type = TYPES.includes(String(d.employment_type)) ? String(d.employment_type) : "Contract";
  return reply({
    title: String(d.title ?? "").trim().slice(0, 120),
    location: String(d.location ?? "Remote (U.S.)").trim().slice(0, 120),
    employment_type: type,
    pay: String(d.pay ?? "").trim().slice(0, 120),
    summary: String(d.summary ?? "").trim().slice(0, 900),
    responsibilities: asList(d.responsibilities, 8),
    requirements: asList(d.requirements, 8),
    confirm: asList(d.confirm, 6),
  });
});

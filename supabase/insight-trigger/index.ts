// Supabase Edge Function: insight-trigger
// Lets the signed-in admin start a hand-picked insight from the admin page.
// POST JSON: { urls: "one web address per line" }   (a list of strings also works)
// It checks that the caller is the signed-in admin, cleans the list (https only, at most 5), and then asks GitHub to run the
// "Daily insight" workflow with those addresses. The workflow reads the pages, the AI checks they are usable and writes one article.
//
// Secrets this function needs (Supabase > Edge Functions > Secrets):
//   GITHUB_DISPATCH_TOKEN  a GitHub fine-grained token for this one repository with "Actions: Read and write" (see supabase/README-insight-trigger.md)
//   GITHUB_REPO            optional, defaults to unsyntax-ai/Triada-Technologies-site
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase itself.
// Deploy with --no-verify-jwt: the function checks the admin itself, the same way admin-pin does.

const ADMIN_EMAIL = "unsyntax.ai@gmail.com";
const MAX_URLS = 5;
const g = globalThis as any;
const env = (k: string, fallback = "") => g.Deno?.env.get(k) ?? fallback;
const SUPABASE_URL = env("SUPABASE_URL", "https://evofqeolhdlteyztrzin.supabase.co");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const REPO = env("GITHUB_REPO", "unsyntax-ai/Triada-Technologies-site");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// the web addresses in whatever was pasted: unique, in order, https only
export function cleanUrls(input: unknown): { urls: string[]; dropped: number } {
  const text = Array.isArray(input) ? input.join("\n") : typeof input === "string" ? input : "";
  const found = (text.match(/https?:\/\/[^\s<>"']+/g) ?? []).map((u) => u.replace(/[.,;)\]}]+$/, ""));
  const unique = [...new Set(found)];
  const good = unique.filter((u) => {
    try {
      const p = new URL(u);
      return p.protocol === "https:" && p.hostname.includes(".") && u.length <= 500;
    } catch { return false; }
  });
  return { urls: good.slice(0, MAX_URLS), dropped: unique.length - Math.min(good.length, MAX_URLS) };
}

async function isAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON_KEY } });
  if (!who.ok) return false;
  const user = await who.json();
  return (user.email ?? "").toLowerCase() === ADMIN_EMAIL;
}

if (g.Deno) {
  g.Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
    try {
      if (!(await isAdmin(req))) return reply({ error: "Please sign in again." }, 401);
      const token = env("GITHUB_DISPATCH_TOKEN");
      if (!token) return reply({ error: "The link tool is not set up yet (the GitHub token is missing)." }, 503);
      const body = await req.json().catch(() => ({}));
      const { urls, dropped } = cleanUrls(body.urls);
      if (!urls.length) return reply({ error: "Paste at least one web address that starts with https://." }, 400);

      const gh = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/insights.yml/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json", "User-Agent": "triada-insight-trigger",
        },
        body: JSON.stringify({ ref: "main", inputs: { urls: urls.join("\n") } }),
      });
      if (gh.status !== 204) {
        const why = gh.status === 401 || gh.status === 403 ? "GitHub did not accept the token." : gh.status === 404 || gh.status === 422 ? "GitHub could not find the Daily insight workflow on main." : "GitHub did not start the run.";
        return reply({ error: why + " Please check the setup notes." }, 502);
      }
      return reply({ ok: true, count: urls.length, dropped });
    } catch {
      return reply({ error: "Something went wrong. Try again." }, 500);
    }
  });
}

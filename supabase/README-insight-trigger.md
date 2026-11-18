# Admin "Post an insight from links": one-time setup

The admin page has a box where you paste up to five web addresses. The page asks a Supabase function (`insight-trigger`) to start the
"Daily insight" GitHub workflow with those addresses. The workflow reads each page, the AI (Gemini, already set up for the daily post)
says whether it is usable, and one new article is written from the usable pages. It is published like any other insight
(about three minutes later). If no page is usable, nothing is posted and the run log says why for each link.

Nothing in the browser holds a GitHub key. The function checks that you are the signed-in admin first.

## Steps (about 5 minutes, no cost)

1. **Make a GitHub token** (GitHub > your avatar > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token)
   - Resource owner: `unsyntax-ai`. Repository access: *Only select repositories* > `Triada-Technologies-site`.
   - Repository permissions: **Actions: Read and write** (nothing else). Set an expiry you are comfortable with (for example 1 year) and note the date.
   - Copy the token once. Do not paste it anywhere except the next step.
2. **Save it in Supabase** (Edge Functions > Secrets): name `GITHUB_DISPATCH_TOKEN`, value the token.
   Optional: `GITHUB_REPO` (only if the repository name changes).
3. **Deploy the function**: Edge Functions > Deploy a new function > name `insight-trigger`, paste `supabase/insight-trigger/index.ts`, and turn **Verify JWT off**
   (the function checks the admin itself, the same way `admin-pin` does).
4. **The workflow must be on `main`.** GitHub starts a workflow from the copy on `main`, so the new "urls" input in `.github/workflows/insights.yml`
   only works after this change is released to `main`.

## Notes
- Posts made this way go live on the real site, because the workflow writes to `main`. Test with a real, useful article link.
- A link is skipped (and the reason is shown in the run's summary under Actions) when it is not https, is not a public website, cannot be read,
  blocks robots, has too little text, or the AI judges it is an advertisement or unrelated to hiring and work.
- The same-day rule is lifted for this mode: you can post more than one insight a day. The "too similar to a recent article" check still applies.
- If the token expires, the admin box says GitHub did not accept the token. Make a new token and replace the secret.

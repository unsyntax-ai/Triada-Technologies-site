# Testing report: Triada mobile version

Date: 2026-10-23. Build under test: the mobile changes in a local copy (not merged, not deployed to production).
Original used for comparison: production `main` at commit `5973cae`.

## Verdict
Every feature that can be exercised without real credentials or a real phone was tested and passed. Desktop and tablet are unchanged. Open items are listed in section 5.

## 1. Desktop and tablet stay unchanged (regression)
Method: each page loaded side by side from the original and from the mobile build at the same width. Every element's tag, id, position, size, display and position, plus font size, colour, background, padding, margin, radius, shadow and blur, were compared.

| Result | Detail |
| --- | --- |
| Pages | Home, Services, About, Jobs, Insights, Insights archive, Contact, an article, a job page, 404, Admin (11) |
| Sizes | 701, 768x1024, 820x1180, 844x390, 932x430, 1024, 1180x820, 1366, 1440, 1920, 2560 (11 sizes) |
| Comparisons | 121 geometry and 121 style comparisons, all identical |
| Admin page | Also identical at 701, 768, 1024 and 1440 after the final change |
| Files not changed | `site.css`, `site.js`, `jobs.js`, `find.js`, `admin.js`, `jobs-config.js` (also byte-identical to production's live copies on the preview site) |
| Excluded | The rotating word's colour (it animates), and the live-jobs timing (one early flake was clean on 3 re-runs) |

## 2. Phone layout
77 checks: 11 pages x 7 sizes (320, 360, 390, 430 portrait; 568x320, 667x375, 700x400 landscape).
Each checks: tab bar with 5 tabs and the right active tab (orange icon outline), desktop menu hidden, Desktop switch visible, old contact button gone, logo 34px, no sideways overflow, every internal link answers 200 (21 distinct links), thumbnails hidden from screen readers.
Result: all passed. (One real problem was found and fixed: admin PIN boxes overflowed at 320px. The original site overflowed there too.)
Landscape phones wider than 700px (for example 844px) use the desktop layout by design.

## 3. Feature checklist (every feature on the site)
| Feature | How it was tested | Result |
| --- | --- | --- |
| Top bar, logo, nav links, header buttons | Real navigation walk: 14 hops across tabs, quick actions, cards, back buttons, logo, footer | Pass |
| Bottom tab bar, active tab, orange icon | All pages and sizes | Pass |
| Desktop / Mobile site switch | Real tap. Switches to 1200px desktop layout, kept across all 10 public pages in that tab, "Mobile site" pill returns. Nothing in localStorage or cookies, a new tab starts on mobile, intro does not replay | Pass |
| Home opening animation | Plays on a fresh tab, tab bar hidden during it, replays on reload, not on the view switch | Pass |
| Home: quick actions, photo tag, hire/work switch, industry chips, swipe rows | Links, taps, scrolling | Pass |
| Services: industry tiles, timeline, swipe cards, FAQ (9), Contact block last | Taps and DOM checks | Pass (FAQ close animation not observable, see 5) |
| About: values rail, mission list | DOM and overflow | Pass |
| Jobs: live list, search and highlight, empty state, type chips and filter | 8 live jobs | Pass |
| Find a Job (resume matcher) | Text 88%, PDF 86%, Word (.docx) 86%; non-resume, empty, unsupported, over 5 MB and under 40 words rejected; no-match path; "Upload a different resume", "Browse all openings", "Send us your resume", Close | Pass |
| Job page | Content, Apply by email, Call, back button, sticky Apply bar, live job data markup | Pass |
| Insights: search, sort, month filter, load more | Scratch site with 18 live and 10 archived articles: 9 shown, load more shows all 18 | Pass |
| Insights archive | Search, month filter, empty state, back button | Pass |
| Article pages | Content, 3 source links, back button, Insights tab active | Pass |
| Contact form | Empty, bad-value and valid cases; "I am" switch drives the real select; preview-only message (nothing sent) | Pass |
| 404 page | Bad address, button, tab bar | Pass |
| Admin sign-in screen | 6 PIN boxes, digits only, forgot-PIN screen, no network request made; no PIN or code was typed against the real backend | Pass |
| Admin signed-in screens | Fake backend in a scratch copy (made-up PIN): wrong PIN message, sign-in, tabs and counts, paging, search, AI draft fill and "please check" list, clear confirm, save draft, publish now, scheduling calendar and time pop-up, edit, archive, restore, two-tap delete, sign-out | Pass |
| Daily AI insight pipeline | Simulated new post builds into a full page with tab bar and Insights tab active, appears in the list and sitemap, "today's post is published" check passes | Pass |
| Accessibility | Names on all buttons and links, image alt text, form labels, one h1, landmarks, language, tab bar label | Pass (a thumbnail link without a name on Insights was fixed for phones) |
| Tap targets, keyboard behaviour | At least 38px; tab bar hides while a field has focus (emulated) | Pass |

## 4. Changes since the last report
- Logo 28px to 34px on phones (same as desktop). Checked at 320px with back button and Desktop pill: no collisions.
- Phone-only: Insights thumbnails hidden from screen readers.
- Phone-only: admin PIN boxes share the row width.

## 4b. Bottom navigation consistency (latest change)
- Audit: the bar's position, size and links were already identical on all 11 pages; three pages (Contact, 404, Admin) had no selected tab. Now every page has exactly one (Contact under Services, 404 under Home, Admin under Jobs).
- Tapping the selected tab scrolls to the top without reloading (checked: stays on the page, scroll-to-top is called); tapping any other tab, including from Contact, navigates.
- Page changes keep the bars still (cross-document view transitions, phone layout only). The test browser accepts the rule; the visual effect could not be watched here, so check it on a real phone.
- Re-run after the change: 77 phone checks pass, 8-hop navigation walk passes, 121 desktop and tablet comparisons identical, phone controls (chips, switches, tiles, Apply bar) still build.

## 5. Not verified / open items
1. **Real phone.** All testing was in a desktop browser with emulated sizes. The viewport swap of the Desktop switch, safe areas, iOS blur effects and the on-screen keyboard need a quick check on a real iPhone and Android phone.
2. **Real backends.** Gemini writing a new post needs the secret key. Real admin sign-in, real job publishing and real AI job drafting need your PIN and live data. These were tested with a fake backend only, so the screens and logic are proven but not the live services. `admin.js` is unchanged.
3. **FAQ closing animation** could not be observed (animations are paused when the test window is not focused). The original behaves the same here and its code is unchanged.
4. **Firefox:** industry tiles show card artwork instead of icons (a CSS feature Firefox lacks).
5. **Landscape phones above 700px** use the desktop layout by design. Raising the breakpoint would also change what tablets see.
6. The public preview omits the admin page on purpose, so "Post a job" is a 404 there. On the real site it works as before.

## 6. Production safety
Nothing is merged. The `mobile` branch and the preview repository hold earlier builds; this report describes newer local changes that have not been pushed.

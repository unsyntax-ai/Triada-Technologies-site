# Testing report: Triada mobile version

Date: 2026-10-23. Build under test: local copy with the mobile changes (not merged, not deployed to production).
Original used for comparison: production repo `main` at commit `5973cae`.

## Verdict
All automated and manual checks that could be run here passed. Desktop and tablet pages are unchanged. The items under "Not verified / open" need your decision or a real device.

## 1. Desktop and tablet stay unchanged (regression)
Method: each page loaded side by side from the original and from the mobile build at the same width. Every element's tag, id, position, size, display, position and key styles (font size, colour, background, padding, margin, radius, shadow, blur) were compared.

| Result | Detail |
| --- | --- |
| Pages | Home, Services, About, Jobs, Insights, Insights archive, Contact, an article, a job page, 404 (10 page types) |
| Widths | 701, 768, 820, 844x390, 932x430, 1024, 1180, 1366, 1440, 1920, 2560 (11 sizes) |
| Comparisons | 110 |
| Geometry identical | 110 / 110 (one early flake at 768 on the live-jobs page was clean on three re-runs) |
| Styles identical | 110 / 110 |
| Files not changed | `site.css`, `site.js`, `jobs.js`, `find.js`, `admin.js`, `jobs-config.js` |
| Rotating word colour | Excluded from comparison because it animates over time |

## 2. Phone layout (360, 390, 430px; landscape 568, 667, 700px)
Per page: bottom tab bar shown with 5 tabs and the correct active tab (orange icon outline), desktop menu hidden, Desktop switch visible, old contact button gone, no sideways overflow, no tap target under 38px, no broken images, every internal link answers 200, all email links point to the company address.
- 10 page types x 3 phone widths: all passed (430px run on the 6 pages with the most logic).
- Phone landscape (3 sizes x 10 pages = 30 checks): all passed. Note: landscape phones wider than 700px (for example 844px) get the desktop layout by design.

## 3. Functions
| Area | Checked | Result |
| --- | --- | --- |
| Tabs and top bar | Every tab goes to its page; Contact no longer in the top bar; Desktop switch | Pass |
| Home | Quick actions link to contact, jobs and email; hire/work switch shows one card; industry chip rail; swipe rows | Pass |
| Services | 9 industry tiles open/close; 6-step timeline; swipe cards; Contact block is last; FAQ has 9 items | Pass (FAQ close not observable, see open items) |
| Jobs | Live listings (8); search and highlight; empty state; type chips drive the real select; Find a Job | Pass |
| Resume matcher | Text resume 88% match; real PDF 86% match; non-resume rejected; empty, unsupported and over-5MB files rejected; under-40-word resumes rejected (existing rule) | Pass |
| Job page | Full content, Apply by email, Call, back button, sticky Apply bar | Pass |
| Insights | Search, empty state, sort, date filter, archive, article pages with back button | Pass |
| Contact | Empty and bad-value validation, error messages, "I am" switch drives the real field, valid submit shows the preview-only message (nothing is sent) | Pass |
| Desktop switch | Switches to 1200px desktop layout in this tab; persists across pages; "Mobile site" pill returns; a new tab starts on mobile; nothing in localStorage or cookies | Pass |
| Keyboard | Tab bar hides while a field is focused | Pass (emulated) |
| Daily AI insight | Simulated new post builds into a full page with tab bar, appears in the list and sitemap; the generator's "today's post is published" check passes | Pass |

## 4. Not verified / open items
1. **Real phone.** Everything ran in a desktop browser with emulated phone sizes. The viewport swap of the Desktop switch, safe areas, iOS blur effects and the on-screen keyboard behaviour need a quick check on a real iPhone and Android phone.
2. **Gemini writing a new post** needs the secret key (not available here). Only the build after a post is written was tested.
3. **Admin job drafting (AI)** is behind the admin sign-in and was not exercised. `admin.js` is unchanged. On phones the admin page also shows the tab bar.
4. **FAQ closing animation** could not be observed in this test browser (animations are paused when the window is not focused). The original site behaves the same here and its code is unchanged.
5. **Firefox**: industry tiles swap to icons with a CSS feature Firefox does not support; there they show the card artwork instead of the icon.
6. **Landscape phones above 700px** use the desktop layout. Raising the breakpoint is possible but would change what tablets see.
7. The preview site omits the admin page on purpose, so "Post a job" is a 404 there.

## 5. Production safety
- Nothing was committed, pushed, merged or deployed to the production repository or its Pages settings.
- The preview lives in a separate repository (`unsyntax-ai/Triada-mobile`), marked noindex.

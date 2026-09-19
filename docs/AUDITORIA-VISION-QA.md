# Vision + QA audit of v1 (the static page) — and what it triggered

> **Date:** 2026-09-20 · **Auditor:** AI vision model (GLM-4.5V) + senior QA pass, over 5 live
> screenshots of `enerbydev.github.io/nitheky-proof` at desktop 1600×900, mobile 390×844,
> scenario B, the Luanda scenario and the post-race state, plus a full source review of
> `index.html`, `motor/`, `web/` and `tests/`.
> **Method:** every finding below was either **seen in a screenshot** (vision model, unedited
> verdicts in `docs/auditoria/vlm-*.json`) or **read in the code**. No finding is speculative.
> This document exists for the same reason the repo does: the work is auditable, including
> its own defects.

---

## Verdict, in the model's own words

> "This looks like a brilliant engineer's internal debugging dashboard, **not a client-facing
> demo.**" — overall **6/10** (desktop).

The two interactions that carry the negotiation scored well: the last-seat race
(**8.5–10**, "crystal clear: SEAT RESERVED vs REFUSED, invariant legible") and the Luanda
country-neutrality case (**9/10**). The logic layer — the 18 tests, the numbers-beside-decisions
style — was never in question. What failed was everything around it.

---

## Critical (blocks the client story)

| # | Finding | Evidence | Fix in v2 |
|---|---------|----------|-----------|
| C1 | **The map is below the fold** at desktop 1600×900. A route-corridor proof where the map cannot be seen without scrolling is missing its own argument. | vision audit of `escritorio-1600.png`: "There is no map visible in this screenshot… a fatal flaw in this view" | Map promoted to the hero position of the right panel, visible on first paint, driver cards scroll *under* it |
| C2 | **Rejection reasons render in Spanish inside an English UI** (`direccion_opuesta: la recogida cae en la fracción…`). The client is German; the page is English; the strings come from `motor/matching.ts`. | vision audit of `escritorio-escenarioB.png`: "breaks the professional polish… hardcoded debug strings leaking into production-facing demos" | Every user-facing string keyed (`rechazo.opuesta` → English copy in the UI layer); motor keeps emitting codes + numbers, the page translates |
| C3 | **Not a fullstack app.** One static file with no server, no API, no CI, no typecheck, no lint. Fine as an arithmetic proof; does not evidence the production stack the proposal promises. | source review: `index.html` + `motor.js` bundle + custom `web/construir-demo.py` pipeline | Rebuilt as a Nuxt 4 fullstack app: Nitro API, Vitest + Playwright, CI, Docker/PostGIS |

## High (visible to a non-technical client)

| # | Finding | Evidence | Fix in v2 |
|---|---------|----------|-----------|
| H1 | "Run the race" button orphaned top-right of its card, big unbalanced hole to its left | desktop audit | Race card rebuilt: button full-width under the explanation, grid-aligned with the two passenger boxes |
| H2 | Score **91.4%** is the output of the whole page and it is 18px in a corner | "needs to be larger, bolder… the hero number" | Hero-sized score, gold, first thing the eye lands on per card |
| H3 | Green `#3fb27f` small text fails WCAG AA on `#0d0e10` | "muddy, not success" | Palette rebuilt on Tailwind 4 tokens with checked contrast (aim: all ≥ 4.5:1) |
| H4 | `drv-isabel` rejection spans full width, "looks like a console.log() leak rather than a polished UI state" | desktop audit | Rejections become compact, uniform rows in a dedicated "rejected" section |
| H5 | Slider thumbs low-contrast and too small for touch; link hit-areas tiny on mobile | mobile audit | Nuxt UI `USlider` (44px targets, filled track, visible focus ring) |
| H6 | Scenario list "vertically tight… wraps aggressively" | desktop audit | Cards get proper padding + line-height; expected outcome becomes a colored badge |
| H7 | Monospace used for prose (the requirement-9 paragraph) | "painful to read" | Prose in Inter, mono only for numbers, ids and code |
| H8 | "verified · ★4.8 (41)" too small/dim to be the trust signal it is | desktop audit | Badges with icons, readable size |
| H9 | Basemap **competes with the data**: standard OSM color tiles under a gold route | measured previously in ALoNNo doc 22 (the CARTO watermark + OSM "compite con el dato" findings) | Esri World Light Gray Base, no key, verified visible in headless Firefox |

## Medium (code quality / robustness)

| # | Finding | Evidence | Fix in v2 |
|---|---------|----------|-----------|
| M1 | Invalid HTML in the pre-race invariant: `<b>0</b ·` (missing `>`); the browser silently recovers, so it was never caught by looking | source `index.html:201` | Gone with the component rewrite |
| M2 | `c.nombre ?? m.conductorId` — `nombre` does not exist on the type; the fallback always wins and the intent (friendly names) is dead code | source `index.html:349`, `motor/matching.ts` | Display names become real data (`Amélia`, `Tomás`…) |
| M3 | Custom build chain: esbuild bundle + `web/entrada.ts` + a Python script to sync `demo.html` — three artifacts for one page | source `web/` | One Nuxt app; the "same code as the tests" property is preserved by importing `motor/` directly |
| M4 | Zero a11y semantics on the custom controls (no labels, no focus styles, no keyboard path for scenario buttons) | source review | Native semantics via Nuxt UI components; `axe`-clean target |
| M5 | No error/loading states anywhere — impossible to show "thinking", so every future slow call would look frozen | source review | Loading + error states on every async surface (race included) |

## What was already right (kept as-is in v2)

- **The empty state as an affirmation** — "zero compatible drivers — this is the correct
  answer for this scenario": the vision model read it as turning "no results" into a
  *validation confirmation*. That sentence stays.
- **The race**: color-coded winner/refused + the invariant line with the numbers in bold —
  scored 8.5–10 on clarity. The design is kept, the chrome around it is rebuilt.
- **Numbers beside every decision** — fractions, metres, minutes, seats: the page never
  asserts without measuring. That is the house rule and it survives unchanged.

---

## The decision this audit forced

A static page cannot fix C1–C3 incrementally without becoming a hand-rolled SPA — which is
exactly the "custom pipeline" problem M3 already was. So the repo is now the thing the
proposal actually promises: a **Nuxt 4 fullstack application** (Nitro API, Vitest, Playwright,
CI, Docker + PostGIS), with the zero-dependency `motor/` — the audited, tested arithmetic —
imported untouched at its core. The screenshots and raw model verdicts that produced this
document live in `docs/auditoria/`.

---

## Re-audit of v2 — same judge, same prompts

| View | v1 | v2 | What changed the verdict |
|---|---|---|---|
| Desktop 1600 | 6/10 "debugging dashboard" | **9.0/10** "no longer an engineer's debug page; this is a Product Demo… Ship it" | map first-paint, hero score, scenario badges, clean grid |
| Scenario B (rejection) | Spanish strings | **10/10** | fractions in English: "pickup falls at fraction 0.526… dropoff at 0.000 — travels backwards" |
| Luanda (country-neutral) | — | **9/10** | distinct corridor + "1 of 1", Joaquim 86.5% |
| Last-seat race | 8.5/10 | **10/10** "Flawless" | one SEAT RESERVED / one REFUSED, invariant line, "ran on the server (Nitro API)" badge |
| Mobile 390 | map buried below settings | **8/10** after the reorder fix | map now lands before the panels (order-2 → order-1 on mobile) |

The v2 verdicts (unedited) live in `docs/auditoria/v2/vlm-v2-*.json`, with the six screenshots.
Two real defects were found and fixed during this re-audit round, both by the tests rather
than by taste: the composable's state was not shared between components (scenarios didn't
switch — caught by E2E), and the in-memory store was captured statically so re-seeding didn't
reach live requests (caught by the E2E API suite running two browser projects).

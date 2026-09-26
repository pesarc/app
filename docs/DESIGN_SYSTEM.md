# Pesarc landing design system (distilled from coin-compass)

The landing (pesarc.xyz) uses the **coin-compass** look: a deep forest-green
surface with a lime-chartreuse accent, on a soft sage page. Calm, premium,
fintech, not "crypto". **Never use the em dash (—) in any copy** (CLAUDE.md rule).

## Palette
| Token | Value | Use |
|---|---|---|
| Page bg | `#e3e8dc` | the sage frame behind the rounded app surface |
| Surface | `linear-gradient(160deg,#0a2a12 0%,#0d3617 45%,#0a2a12 100%)` | main dark-green panel |
| Surface solid | `#0a2a12` / `#0d3617` | flat green fills |
| **Accent (lime)** | `#c8f542` | CTAs, highlights, icons, heading accent spans |
| Accent text-on-lime | `#12300f` | text/icons sitting on a lime button |
| Text | `#ffffff`, then `white/80 /60 /55 /50 /40` | body + muted |
| Glass card | bg `rgba(255,255,255,0.09)`, border `rgba(255,255,255,0.14)`, shadow `0 20px 40px -12px rgba(0,0,0,0.3)` | floating cards |
| Lime chip | bg `rgba(200,245,66,0.06)`, border `rgba(200,245,66,0.35)` | eyebrow pills |
| Section rule | `1px solid rgba(255,255,255,0.08)` | top border between sections |

## Type
- Display / headings: **Geist** (300-600), `tracking-tighter`, line-height ~1.15.
  Headings carry one lime `<span>` accent word.
- Body / UI: **Inter**.
- Eyebrows/labels: uppercase, `tracking-widest`, `white/40`.

## Shape + effects
- Outer container: `rounded-[28px]`, the whole page is one rounded panel on the
  sage bg. Cards `rounded-2xl` (16px). Pills/buttons `rounded-full`.
- Glass cards use `backdrop-blur-md`. Hover: `-translate-y-1.5`, `scale-[1.03]`.
- Diagonal hatch overlay: `repeating-linear-gradient(115deg,rgba(255,255,255,0.025) 0,rgba(255,255,255,0.025) 1px,transparent 1px,transparent 56px)`.
- Icons: Iconify **solar** linear set, `stroke-width:1.5`.

## Section rhythm (repeat)
1. Eyebrow pill (lime chip: icon + short label).
2. Big heading, `tracking-tighter`, with one lime accent span.
3. Muted subtext (`white/60`, `max-w-md`).
4. Grid of glass cards (icon tile in `rgba(200,245,66,0.15)` → title → muted body).

## Landing-specific rules (from the founder)
- **Hero stays**, but the globe (Globe.tsx) sits in the background and stays
  faintly visible THROUGH the scrolling sections (like agentic-AI.html's fixed
  canvas): section backgrounds are slightly transparent over a fixed globe.
- Talk about the **features** (see PRODUCT_ROADMAP.md). **Never mention the
  "no USDC / dollar bypass" angle in marketing** — omit it entirely.
- A **networks + banks supported** section.
- Call it **"early beta-testers"**, never "waitlist".
- pesarc.xyz is the landing; the app is reached only at app.pesarc.xyz after login.

## Scope note
Apply this to the **landing** first. The in-app dashboard currently uses the
"Relief" system (sky/harbor/snow in tailwind.config.ts); confirm before changing
global product tokens.

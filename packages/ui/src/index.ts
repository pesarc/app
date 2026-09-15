// Pesarc design system — the shared source of truth (web + mobile).
// Fused from the "Relief" reference: a warm cream canvas, deep-harbor navy
// content blocks, a single vivid sky-blue accent, chunky flat "pop" shadows,
// and rounded, friendly type. Orange/emerald/gold retired.
//
// Discipline: ONE chromatic accent (sky). Navy anchors content; cream is the
// canvas (never pure white for the page). Shadows are flat solid offsets, never
// blurred. Buttons and badges are pills.

/** Color tokens. */
export const colors = {
  // canvas & surfaces
  cream: "#f9f7f0", // page canvas — never pure white
  snow: "#ffffff", // elevated cards, inputs
  harbor: "#13426f", // deep navy — content blocks, headings, card fills
  // text
  ink: "#333333", // primary body text
  charcoal: "#212121", // heaviest emphasis
  slate: "#616c8a", // muted secondary text
  fog: "#d0d5dd", // hairline borders
  slateBorder: "#40444e", // stronger borders
  // the single accent (sky)
  sky: "#2e96ff", // primary action, active state, key emphasis
  skyDeep: "#0254a5", // ghost/outline borders, hover
  skyTint: "#bde1f9", // badge / trust-pill backgrounds
  skyWash: "#cde7fb", // pop-shadow tone family
  skyMid: "#50a7ff", // decorative mid-tone
  infoMist: "#73b9ff", // decorative icon accent
  // states (derived from the palette — no new hues)
  success: "#0254a5",
  danger: "#c0392b",
} as const;

/** Type — Manrope (free, geometric; Gilroy is proprietary). Tight tracking. */
export const type = {
  family:
    '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  tracking: "-0.018em", // uniform tight tracking at every size
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  scale: {
    caption: { size: 12, leading: 1.5, tracking: -0.22 },
    bodySm: { size: 14, leading: 1.5, tracking: -0.25 },
    body: { size: 16, leading: 1.6, tracking: -0.29 },
    subheading: { size: 18, leading: 1.5, tracking: -0.32 },
    headingSm: { size: 20, leading: 1.4, tracking: -0.36 },
    heading: { size: 32, leading: 1.29, tracking: -0.58 },
    headingLg: { size: 40, leading: 1.2, tracking: -0.72 },
    display: { size: 58, leading: 1.1, tracking: -1.04 },
  },
} as const;

/** Rounded, friendly geometry — pills for interactive, soft cards. */
export const radius = {
  card: 18, // 18–30 in practice
  cardLg: 30,
  hero: 49,
  pill: 999,
} as const;

/** The signature: flat solid offset shadows, never blur. */
export const shadow = {
  pop: "rgba(154,207,246,0.5) 0px 7px 0px 0px", // primary CTA lift
  popSm: "rgba(154,207,246,0.5) 0px 5px 0px 0px", // secondary
  card: "rgba(0,0,0,0.05) 0px 3px 0px 0px", // barely-there card
} as const;

export const spacing = {
  page: 1200, // max content width
  card: 28, // card padding
  gap: 14, // element gap
  section: 72, // section rhythm (56–80)
} as const;

export type Colors = typeof colors;

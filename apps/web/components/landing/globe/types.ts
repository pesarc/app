// Shared types for the lightweight canvas globe.

export type GlobeControls = {
  /** How often payment pings fire (0..2). */
  signalRate: number;
  /** Arc altitude / reach (0.1..2). */
  dotSize: number;
  /** Auto-rotation speed (0..0.5). */
  spin: number;
  /** Atmosphere glow (0.1..1). */
  glow: number;
  /** Accent color (hex). */
  color: string;
};

export type Country = { n: string; p: [number, number][][] };

// Financial hubs across every continent — pings hop between these. Each carries
// a short region + settlement stat so the globe can surface stylish region info
// as an arc lands. Global-South corridors are weighted (Pesarc's home turf).
export type Hub = {
  name: string;
  region: string;
  stat: string;
  lat: number;
  lng: number;
  south?: boolean;
};

export type Vec3 = [number, number, number];

export type CountryStat = { pop: number; gdp: number };
export type HoverInfo = { name: string; stat?: CountryStat; x: number; y: number };

export type Arc = { a: Vec3; b: Vec3; start: number };
export type Ring = { v: Vec3; start: number };
// A landed ping surfaces a stylish region chip near the destination hub.
export type Label = { hub: Hub; v: Vec3; start: number };

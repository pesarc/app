// Static data + timing constants for the canvas globe.

import type { GlobeControls, Hub } from "./types";

// Relief defaults — a calm sky-accented globe when no live tuner drives it.
export const DEFAULT_CONTROLS: GlobeControls = {
  signalRate: 1.2,
  dotSize: 1,
  spin: 0.1,
  glow: 0.9,
  color: "#2e96ff",
};

export const HUBS: Hub[] = [
  { name: "Lagos", region: "Nigeria", stat: "cNGN · ₦", lat: 6.5, lng: 3.4, south: true },
  { name: "Nairobi", region: "Kenya", stat: "cKES · KSh", lat: -1.29, lng: 36.82, south: true },
  { name: "Accra", region: "Ghana", stat: "cGHS · ₵", lat: 5.6, lng: -0.19, south: true },
  { name: "Johannesburg", region: "South Africa", stat: "cZAR · R", lat: -26.2, lng: 28.04, south: true },
  { name: "Cairo", region: "Egypt", stat: "cEGP · £", lat: 30.04, lng: 31.24, south: true },
  { name: "Mumbai", region: "India", stat: "cINR · ₹", lat: 19.07, lng: 72.87, south: true },
  { name: "São Paulo", region: "Brazil", stat: "cBRL · R$", lat: -23.55, lng: -46.63, south: true },
  { name: "Manila", region: "Philippines", stat: "cPHP · ₱", lat: 14.6, lng: 120.98, south: true },
  { name: "Dubai", region: "UAE", stat: "USDC · $", lat: 25.2, lng: 55.27, south: true },
  { name: "London", region: "United Kingdom", stat: "USDC · £", lat: 51.5, lng: -0.12 },
  { name: "Frankfurt", region: "Germany", stat: "USDC · €", lat: 50.11, lng: 8.68 },
  { name: "New York", region: "United States", stat: "USDC · $", lat: 40.71, lng: -74.0 },
  { name: "Singapore", region: "Singapore", stat: "USDC · $", lat: 1.35, lng: 103.82 },
  { name: "Sydney", region: "Australia", stat: "USDC · $", lat: -33.87, lng: 151.21 },
];

export const DEG = Math.PI / 180;
export const FLIGHT_MS = 1600;
export const RING_MS = 1400;
export const LABEL_MS = 2600;

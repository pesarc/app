// Pure math + formatting helpers for the canvas globe.

import { DEG } from "./data";
import type { Vec3 } from "./types";

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const trimZeros = (s: string) => s.replace(/\.?0+$/, "");

export function fmtPop(n?: number): string {
  if (!n) return "-";
  if (n >= 1e9) return trimZeros((n / 1e9).toFixed(2)) + "B";
  if (n >= 1e6) return trimZeros((n / 1e6).toFixed(n >= 1e7 ? 0 : 1)) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

export function fmtUSD(n?: number): string {
  if (!n) return "-";
  if (n >= 1e12) return "$" + trimZeros((n / 1e12).toFixed(2)) + "T";
  if (n >= 1e9) return "$" + Math.round(n / 1e9) + "B";
  if (n >= 1e6) return "$" + Math.round(n / 1e6) + "M";
  return "$" + n;
}

export function toVec3(lat: number, lng: number): Vec3 {
  const phi = lat * DEG;
  const lam = lng * DEG;
  return [
    Math.cos(phi) * Math.cos(lam),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(lam),
  ];
}

// Spherical linear interpolation between two unit vectors.
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  dot = Math.min(1, Math.max(-1, dot));
  const th = Math.acos(dot);
  if (th < 1e-6) return a;
  const s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s;
  const w2 = Math.sin(t * th) / s;
  return [
    w1 * a[0] + w2 * b[0],
    w1 * a[1] + w2 * b[1],
    w1 * a[2] + w2 * b[2],
  ];
}

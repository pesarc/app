"use client";

// Lightweight canvas globe — replaces globe.gl/three.js (~500KB of JS + a
// 480KB geojson + an earth texture pulled from CDNs) with a ~9KB component
// and a 39KB-gzipped simplified country dataset served from /public.
// Renders its first frame immediately; countries stream in when the tiny
// dataset arrives. Same GlobeControls API as before, so the hero's Network
// Tuner keeps working unchanged.

import { useEffect, useRef } from "react";

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

type Props = { controls?: GlobeControls };

// Relief defaults — a calm sky-accented globe when no live tuner drives it.
const DEFAULT_CONTROLS: GlobeControls = {
  signalRate: 1.2,
  dotSize: 1,
  spin: 0.1,
  glow: 0.9,
  color: "#2e96ff",
};

type Country = { n: string; p: [number, number][][] };

// Financial hubs across every continent — pings hop between these.
const HUBS: { name: string; lat: number; lng: number }[] = [
  { name: "Lagos", lat: 6.5, lng: 3.4 },
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Accra", lat: 5.6, lng: -0.19 },
  { name: "Johannesburg", lat: -26.2, lng: 28.04 },
  { name: "London", lat: 51.5, lng: -0.12 },
  { name: "Frankfurt", lat: 50.11, lng: 8.68 },
  { name: "New York", lat: 40.71, lng: -74.0 },
  { name: "Toronto", lat: 43.65, lng: -79.38 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Mumbai", lat: 19.07, lng: 72.87 },
  { name: "Dubai", lat: 25.2, lng: 55.27 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Shanghai", lat: 31.23, lng: 121.47 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
];

const DEG = Math.PI / 180;
const FLIGHT_MS = 1600;
const RING_MS = 1400;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Vec3 = [number, number, number];

function toVec3(lat: number, lng: number): Vec3 {
  const phi = lat * DEG;
  const lam = lng * DEG;
  return [
    Math.cos(phi) * Math.cos(lam),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(lam),
  ];
}

// Spherical linear interpolation between two unit vectors.
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
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

type Arc = { a: Vec3; b: Vec3; start: number };
type Ring = { v: Vec3; start: number };

export default function Globe({ controls }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef(controls ?? DEFAULT_CONTROLS);
  ctrlRef.current = controls ?? DEFAULT_CONTROLS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let spawnTimer: ReturnType<typeof setTimeout>;
    let countries: Country[] = [];
    // Per-country precomputed unit vectors (built once when data arrives).
    let shapes: { t: number; rings: Vec3[][] }[] = [];
    let arcs: Arc[] = [];
    let rings: Ring[] = [];
    let rotation = -6 * DEG; // matches the old initial point of view
    let dragging = false;
    let lastX = 0;
    let dragVel = 0;
    let visible = true;
    let W = 0;
    let H = 0;
    let dpr = 1;

    const TILT = -14 * DEG; // view latitude, like the old pointOfView lat:14

    const resize = () => {
      const el = canvas.parentElement!;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = el.clientWidth;
      H = el.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    // Tiny simplified dataset (~39KB gz), self-hosted.
    fetch("/datasets/world-simple.json")
      .then((r) => r.json())
      .then((data: Country[]) => {
        if (disposed) return;
        countries = data;
        shapes = countries.map((c) => ({
          t: hashStr(c.n),
          rings: c.p.map((ring) => ring.map(([lng, lat]) => toVec3(lat, lng))),
        }));
      })
      .catch(() => {
        /* offline — globe renders without countries */
      });

    // Rotate a unit vector by current view (Y-axis rotation + X tilt),
    // returning screen x/y and depth z (z > 0 faces the camera).
    // Screen x is negated so east appears to the RIGHT with north up —
    // without it the map renders mirrored.
    const project = (v: Vec3, R: number, cx: number, cy: number) => {
      const cr = Math.cos(rotation);
      const sr = Math.sin(rotation);
      const x1 = v[0] * cr + v[2] * sr;
      const z1 = -v[0] * sr + v[2] * cr;
      const ct = Math.cos(TILT);
      const st = Math.sin(TILT);
      const y2 = v[1] * ct - z1 * st;
      const z2 = v[1] * st + z1 * ct;
      return { x: cx - x1 * R, y: cy - y2 * R, z: z2 };
    };

    const spawn = () => {
      if (disposed) return;
      const c = ctrlRef.current;
      const i = Math.floor(Math.random() * HUBS.length);
      let j = Math.floor(Math.random() * HUBS.length);
      if (j === i) j = (j + 1) % HUBS.length;
      const now = performance.now();
      arcs.push({
        a: toVec3(HUBS[i].lat, HUBS[i].lng),
        b: toVec3(HUBS[j].lat, HUBS[j].lng),
        start: now,
      });
      rings.push({ v: toVec3(HUBS[i].lat, HUBS[i].lng), start: now });
      rings.push({
        v: toVec3(HUBS[j].lat, HUBS[j].lng),
        start: now + FLIGHT_MS,
      });
      const interval = lerp(2600, 500, c.signalRate / 2);
      spawnTimer = setTimeout(spawn, interval * (0.6 + Math.random() * 0.7));
    };
    spawnTimer = setTimeout(spawn, 400);

    let lastT = performance.now();
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      const c = ctrlRef.current;
      const dt = Math.min(now - lastT, 100);
      lastT = now;

      if (!dragging) {
        // Auto-rotate west→east (features drift left→right, like Earth seen
        // from space) at a calm pace: spin 0.12 ≈ one revolution / ~85s.
        rotation -= c.spin * 0.000625 * dt;
        rotation += dragVel;
        dragVel *= 0.94;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.36;
      const [ar, ag, ab] = hexToRgb(c.color);

      // Atmosphere glow
      const glowR = R * (1.08 + 0.35 * c.glow);
      const grad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, glowR);
      grad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${0.22 * c.glow})`);
      grad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Ocean disc
      const ocean = ctx.createRadialGradient(
        cx - R * 0.35,
        cy - R * 0.35,
        R * 0.2,
        cx,
        cy,
        R
      );
      // Harbor-navy sphere — reads as a deep, on-brand globe on the cream canvas.
      ocean.addColorStop(0, "#1d4e80");
      ocean.addColorStop(1, "#0c2a49");
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.25)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Countries (front hemisphere only) — landmasses in a lighter harbor tone
      // that lifts toward the sky accent.
      const base = [43, 88, 136];
      for (const s of shapes) {
        const k = 0.18 + 0.7 * s.t;
        ctx.fillStyle = `rgb(${Math.round(base[0] + (ar - base[0]) * k)}, ${Math.round(
          base[1] + (ag - base[1]) * k
        )}, ${Math.round(base[2] + (ab - base[2]) * k)})`;
        for (const ring of s.rings) {
          let any = false;
          ctx.beginPath();
          let started = false;
          for (const v of ring) {
            const p = project(v, R, cx, cy);
            if (p.z > -0.02) any = true;
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else ctx.lineTo(p.x, p.y);
          }
          if (!any) continue;
          ctx.closePath();
          ctx.save();
          // Clip to the globe disc so back-hemisphere spill stays hidden.
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.clip();
          ctx.beginPath();
          started = false;
          let visiblePts = 0;
          for (const v of ring) {
            const p = project(v, R, cx, cy);
            if (p.z <= 0) {
              // project back-facing points onto the horizon edge
              const dx = p.x - cx;
              const dy = p.y - cy;
              const d = Math.hypot(dx, dy) || 1;
              const ex = cx + (dx / d) * R;
              const ey = cy + (dy / d) * R;
              if (!started) {
                ctx.moveTo(ex, ey);
                started = true;
              } else ctx.lineTo(ex, ey);
            } else {
              visiblePts++;
              if (!started) {
                ctx.moveTo(p.x, p.y);
                started = true;
              } else ctx.lineTo(p.x, p.y);
            }
          }
          if (visiblePts > 1) {
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Rings (landing pulses)
      rings = rings.filter((r) => now - r.start < RING_MS);
      for (const r of rings) {
        if (now < r.start) continue;
        const t = (now - r.start) / RING_MS;
        const p = project(r.v, R, cx, cy);
        if (p.z <= 0) continue;
        const rad = t * R * 0.09;
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${(1 - t) * p.z})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rad, rad * Math.max(p.z, 0.35), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Arcs (payment pings) — great-circle path lifted by arc reach
      arcs = arcs.filter((a) => now - a.start < FLIGHT_MS + 500);
      for (const a of arcs) {
        const t1 = Math.min((now - a.start) / FLIGHT_MS, 1);
        const t0 = Math.max(t1 - 0.45, 0);
        const lift = 0.18 * c.dotSize;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        let started = false;
        const STEPS = 24;
        for (let s = 0; s <= STEPS; s++) {
          const t = t0 + ((t1 - t0) * s) / STEPS;
          const v = slerp(a.a, a.b, t);
          const alt = 1 + lift * Math.sin(Math.PI * t);
          const p = project([v[0] * alt, v[1] * alt, v[2] * alt], R, cx, cy);
          if (p.z <= -0.15) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        const fade = t1 >= 1 ? 1 - (now - a.start - FLIGHT_MS) / 500 : 1;
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.9 * Math.max(fade, 0)})`;
        ctx.stroke();
        // head dot
        if (t1 < 1) {
          const v = slerp(a.a, a.b, t1);
          const alt = 1 + lift * Math.sin(Math.PI * t1);
          const p = project([v[0] * alt, v[1] * alt, v[2] * alt], R, cx, cy);
          if (p.z > 0) {
            ctx.fillStyle = `rgb(${ar}, ${ag}, ${ab})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // Drag to rotate (the globe was draggable before)
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      // Content follows the pointer (screen x decreases as rotation grows).
      rotation -= dx * 0.005;
      dragVel = -dx * 0.0015;
    };
    const up = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    // Don't burn CPU when the hero is scrolled offscreen. (Hidden tabs are
    // already handled natively — browsers suspend requestAnimationFrame.)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(spawnTimer);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[1]">
      <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing" />
    </div>
  );
}

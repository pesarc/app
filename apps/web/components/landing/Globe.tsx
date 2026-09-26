"use client";

// Lightweight canvas globe — replaces globe.gl/three.js (~500KB of JS + a
// 480KB geojson + an earth texture pulled from CDNs) with a ~9KB component
// and a 39KB-gzipped simplified country dataset served from /public.
// Renders its first frame immediately; countries stream in when the tiny
// dataset arrives. Same GlobeControls API as before, so the hero's Network
// Tuner keeps working unchanged.

import { useEffect, useRef, useState } from "react";

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

// Financial hubs across every continent — pings hop between these. Each carries
// a short region + settlement stat so the globe can surface stylish region info
// as an arc lands. Global-South corridors are weighted (Pesarc's home turf).
type Hub = {
  name: string;
  region: string;
  stat: string;
  lat: number;
  lng: number;
  south?: boolean;
};
const HUBS: Hub[] = [
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

const DEG = Math.PI / 180;
const FLIGHT_MS = 1600;
const RING_MS = 1400;
const LABEL_MS = 2600;

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

const trimZeros = (s: string) => s.replace(/\.?0+$/, "");
function fmtPop(n?: number): string {
  if (!n) return "-";
  if (n >= 1e9) return trimZeros((n / 1e9).toFixed(2)) + "B";
  if (n >= 1e6) return trimZeros((n / 1e6).toFixed(n >= 1e7 ? 0 : 1)) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}
function fmtUSD(n?: number): string {
  if (!n) return "-";
  if (n >= 1e12) return "$" + trimZeros((n / 1e12).toFixed(2)) + "T";
  if (n >= 1e9) return "$" + Math.round(n / 1e9) + "B";
  if (n >= 1e6) return "$" + Math.round(n / 1e6) + "M";
  return "$" + n;
}

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

type CountryStat = { pop: number; gdp: number };
type HoverInfo = { name: string; stat?: CountryStat; x: number; y: number };

type Arc = { a: Vec3; b: Vec3; start: number };
type Ring = { v: Vec3; start: number };
// A landed ping surfaces a stylish region chip near the destination hub.
type Label = { hub: Hub; v: Vec3; start: number };

export default function Globe({ controls }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef(controls ?? DEFAULT_CONTROLS);
  ctrlRef.current = controls ?? DEFAULT_CONTROLS;

  // Hovered country (screen-space) — drives the info tooltip. Set from the
  // pointer-move hit-test inside the effect via this stable ref.
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const setHoverRef = useRef(setHover);
  setHoverRef.current = setHover;

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
    let shapes: { name: string; t: number; rings: Vec3[][] }[] = [];
    let stats: Record<string, CountryStat> = {};
    let hoveredIdx = -1; // country under the pointer (front hemisphere only)
    let pointer: { x: number; y: number } | null = null; // canvas-space
    let arcs: Arc[] = [];
    let rings: Ring[] = [];
    let labels: Label[] = [];
    // Precomputed hub unit-vectors (network nodes drawn on the front face).
    const hubVecs = HUBS.map((h) => toVec3(h.lat, h.lng));
    let rotation = -6 * DEG; // matches the old initial point of view
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragVel = 0;
    let visible = true;
    let W = 0;
    let H = 0;
    let dpr = 1;
    // Last frame's globe geometry, so the pointer hit-test matches what's drawn.
    let lastR = 0;
    let lastCx = 0;
    let lastCy = 0;

    let tilt = -14 * DEG; // view latitude (pointOfView lat:14); drag adjusts it

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
          name: c.n,
          t: hashStr(c.n),
          rings: c.p.map((ring) => ring.map(([lng, lat]) => toVec3(lat, lng))),
        }));
      })
      .catch(() => {
        /* offline — globe renders without countries */
      });

    // Population + GDP per country (approximate) for the hover tooltip.
    fetch("/datasets/country-stats.json")
      .then((r) => r.json())
      .then((s: Record<string, CountryStat>) => {
        if (!disposed) stats = s;
      })
      .catch(() => {
        /* tooltip simply omits the figures */
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
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const y2 = v[1] * ct - z1 * st;
      const z2 = v[1] * st + z1 * ct;
      return { x: cx - x1 * R, y: cy - y2 * R, z: z2 };
    };

    // Project a vertex, clamping back-facing points to the horizon edge — mirrors
    // how the countries are drawn, so hit-testing matches the visible outline.
    const projClamp = (v: Vec3, R: number, cx: number, cy: number) => {
      const p = project(v, R, cx, cy);
      if (p.z > 0) return { x: p.x, y: p.y };
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      return { x: cx + (dx / d) * R, y: cy + (dy / d) * R };
    };

    const pointInRing = (px: number, py: number, pts: { x: number; y: number }[]) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    // Which country (if any) is under a canvas-space point. Front hemisphere
    // only; on overlap picks the nearer landmass.
    const hitTest = (px: number, py: number): number => {
      const R = lastR;
      const cx = lastCx;
      const cy = lastCy;
      if (!R || Math.hypot(px - cx, py - cy) > R) return -1;
      let best = -1;
      let bestZ = -Infinity;
      for (let i = 0; i < shapes.length; i++) {
        for (const ring of shapes[i].rings) {
          let zsum = 0;
          let front = 0;
          for (const v of ring) {
            const p = project(v, R, cx, cy);
            zsum += p.z;
            if (p.z > 0) front++;
          }
          if (front < 3) continue;
          const pts = ring.map((v) => projClamp(v, R, cx, cy));
          if (pointInRing(px, py, pts)) {
            const z = zsum / ring.length;
            if (z > bestZ) {
              bestZ = z;
              best = i;
            }
          }
        }
      }
      return best;
    };

    // Weighted pick — Global-South hubs surface ~2× as often (Pesarc's corridors).
    const pickHub = (not = -1) => {
      for (let tries = 0; tries < 8; tries++) {
        const k = Math.floor(Math.random() * HUBS.length);
        if (k === not) continue;
        if (HUBS[k].south || Math.random() < 0.5) return k;
      }
      return not === 0 ? 1 : 0;
    };

    const spawn = () => {
      if (disposed) return;
      const c = ctrlRef.current;
      const i = pickHub();
      const j = pickHub(i);
      const now = performance.now();
      arcs.push({ a: hubVecs[i], b: hubVecs[j], start: now });
      rings.push({ v: hubVecs[i], start: now });
      rings.push({ v: hubVecs[j], start: now + FLIGHT_MS });
      // Reveal the destination region as the ping lands.
      labels.push({ hub: HUBS[j], v: hubVecs[j], start: now + FLIGHT_MS });
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
      lastCx = cx;
      lastCy = cy;
      lastR = R;
      const [ar, ag, ab] = hexToRgb(c.color);

      // Ocean disc — deep harbor night, lit from the upper-left so the sphere
      // has real form. Darker than before (was #1d4e80→#0c2a49).
      const ocean = ctx.createRadialGradient(
        cx - R * 0.4,
        cy - R * 0.4,
        R * 0.15,
        cx,
        cy,
        R * 1.02
      );
      ocean.addColorStop(0, "#123f6b");
      ocean.addColorStop(0.55, "#0b2949");
      ocean.addColorStop(1, "#061626");
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.18)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Countries (front hemisphere only) — clearly brighter than the ocean so
      // coastlines read crisp, each landmass a slightly different sky-lifted
      // tone. High land/ocean contrast is what keeps the sphere from looking
      // soft.
      const base = [46, 98, 158];
      for (let si = 0; si < shapes.length; si++) {
        const s = shapes[si];
        const isHover = si === hoveredIdx;
        const k = 0.16 + 0.5 * s.t;
        ctx.fillStyle = isHover
          ? "rgb(58, 160, 255)"
          : `rgb(${Math.round(base[0] + (ar - base[0]) * k)}, ${Math.round(
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
            // Crisp sky-tinted coastline for definition; brighter when hovered.
            ctx.strokeStyle = isHover ? "rgba(232, 250, 190, 0.95)" : "rgba(58, 160, 255, 0.28)";
            ctx.lineWidth = isHover ? 1.1 : 0.7;
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

      // Network nodes — every hub the arcs can reach shows as a small node on
      // the front face, so the sphere reads as a live network, not a texture.
      for (let h = 0; h < hubVecs.length; h++) {
        const p = project(hubVecs[h], R, cx, cy);
        if (p.z <= 0.05) continue;
        const dim = 0.35 + 0.55 * p.z;
        ctx.fillStyle = HUBS[h].south
          ? `rgba(${ar}, ${ag}, ${ab}, ${dim})`
          : `rgba(150, 179, 214, ${0.5 * dim})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HUBS[h].south ? 1.5 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Region chips — as a ping lands, float a stylish label off the hub with
      // the region and the local stable it settles in. Fades over LABEL_MS.
      labels = labels.filter((l) => now >= l.start && now - l.start < LABEL_MS);
      // Newest last so it draws on top; cap the count to keep it calm. Suppressed
      // on small screens, where the globe sits behind the hero copy.
      const shownLabels = W >= 640 ? labels.slice(-3) : [];
      for (const l of shownLabels) {
        const p = project(l.v, R, cx, cy);
        if (p.z <= 0.08) continue;
        const t = (now - l.start) / LABEL_MS;
        // ease-out rise + fade at the tail
        const rise = 1 - Math.pow(1 - Math.min(t * 3, 1), 2);
        const alpha = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
        if (alpha <= 0) continue;

        const oy = -14 - 12 * rise; // lift above the node
        const lx = p.x;
        const ly = p.y + oy;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font =
          "700 11px ui-sans-serif, system-ui, -apple-system, 'Manrope', sans-serif";
        const title = l.hub.name;
        const sub = `${l.hub.region} · ${l.hub.stat}`;
        ctx.font =
          "600 9.5px ui-sans-serif, system-ui, -apple-system, 'Manrope', sans-serif";
        const subW = ctx.measureText(sub).width;
        ctx.font =
          "800 11px ui-sans-serif, system-ui, -apple-system, 'Manrope', sans-serif";
        const titleW = ctx.measureText(title).width;
        const padX = 9;
        const w = Math.max(titleW, subW) + padX * 2;
        const hgt = 30;
        const bx = lx - w / 2;
        const by = ly - hgt;

        // connector line from node up to the chip
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.5 * alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(lx, by + hgt);
        ctx.stroke();

        // frosted-dark chip
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + w, by, bx + w, by + hgt, r);
        ctx.arcTo(bx + w, by + hgt, bx, by + hgt, r);
        ctx.arcTo(bx, by + hgt, bx, by, r);
        ctx.arcTo(bx, by, bx + w, by, r);
        ctx.closePath();
        ctx.fillStyle = "rgba(6, 20, 38, 0.82)";
        ctx.fill();
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.55 * alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // accent dot + title + subtitle
        ctx.fillStyle = `rgb(${ar}, ${ag}, ${ab})`;
        ctx.beginPath();
        ctx.arc(bx + padX + 2, by + 11, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font =
          "800 11px ui-sans-serif, system-ui, -apple-system, 'Manrope', sans-serif";
        ctx.fillText(title, bx + padX + 8, by + 11);
        ctx.fillStyle = "rgba(197, 216, 240, 0.9)";
        ctx.font =
          "600 9.5px ui-sans-serif, system-ui, -apple-system, 'Manrope', sans-serif";
        ctx.fillText(sub, bx + padX, by + 22);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);

    // Drag to rotate (the globe was draggable before)
    const clearHover = () => {
      pointer = null;
      if (hoveredIdx !== -1) {
        hoveredIdx = -1;
        setHoverRef.current(null);
      }
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      clearHover();
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        // Horizontal drag spins (Y axis); vertical drag tilts (X axis), clamped
        // shy of the poles so the globe never flips.
        rotation -= dx * 0.005;
        tilt = Math.max(-1.2, Math.min(1.2, tilt + dy * 0.005));
        dragVel = -dx * 0.0015;
        return;
      }
      // Hover: find the country under the pointer and surface its stats. The
      // tooltip follows the cursor, so we update position every move.
      pointer = { x: px, y: py };
      const idx = hitTest(px, py);
      hoveredIdx = idx;
      if (idx === -1) {
        setHoverRef.current(null);
      } else {
        const s = shapes[idx];
        setHoverRef.current({ name: s.name, stat: stats[s.name], x: px, y: py });
      }
    };
    const up = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", clearHover);

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
      canvas.removeEventListener("pointerleave", clearHover);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[1]">
      <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing touch-none" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: hover.x, top: hover.y, transform: "translate(-50%, calc(-100% - 12px))" }}
        >
          <div className="rounded-xl bg-[#06162a]/90 border border-sky/40 px-3 py-2 shadow-pop min-w-[130px] whitespace-nowrap">
            <div className="text-[12px] font-extrabold text-white leading-tight">{hover.name}</div>
            <div className="mt-1 flex items-center gap-3 text-[10.5px] font-bold">
              <span className="text-[#8fbcff]">
                Pop <span className="text-white">{fmtPop(hover.stat?.pop)}</span>
              </span>
              <span className="text-[#8fbcff]">
                GDP <span className="text-white">{fmtUSD(hover.stat?.gdp)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

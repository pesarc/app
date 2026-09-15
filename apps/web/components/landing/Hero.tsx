"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Server, Settings } from "lucide-react";
import Globe, { type GlobeControls } from "./Globe";
import { site } from "@pesarc/sdk/site";

const COLORS = ["#35E39C", "#F5C451", "#7C9CFF"];

export default function Hero() {
  const [controls, setControls] = useState<GlobeControls>({
    signalRate: 1.1,
    dotSize: 0.9,
    spin: 0.12,
    glow: 0.85,
    color: "#35E39C",
  });

  const set = (patch: Partial<GlobeControls>) =>
    setControls((c) => ({ ...c, ...patch }));

  return (
    <section className="relative w-full h-screen flex flex-col justify-between p-6 md:p-12 overflow-hidden border-b border-zinc-900">
      <div className="absolute inset-0 pointer-events-none grid-overlay z-0" />

      {/* Globe — shifted right of centre, on the back layer so foreground UI stays readable */}
      <div className="absolute inset-y-0 left-1/2 lg:left-[65%] -translate-x-1/2 w-full lg:w-[82%] z-0">
        <Globe controls={controls} />
      </div>

      {/* Left-to-right fade keeps the headline + CTAs legible over the globe */}
      <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent lg:via-[#09090b]/40" />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#35E39C]/10 blur-[120px] rounded-full z-0 pointer-events-none" />

      {/* Header */}
      <header
        className="relative z-20 flex justify-between items-start animate-fade-in pointer-events-none"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded bg-white text-black font-mono text-xs font-medium">
              SA
            </div>
            <span className="text-xl tracking-tight text-white font-medium">
              {site.name}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-11 mt-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Cross-Border Settlement
            </span>
            <div className="h-px w-8 bg-zinc-800" />
          </div>
        </div>

        <nav className="pointer-events-auto hidden md:flex items-center gap-8">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-mono text-xs text-zinc-400 hover:text-white transition-colors uppercase tracking-widest"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/home"
            className="text-sm px-5 py-2 bg-white text-zinc-950 font-medium hover:bg-zinc-200 transition-colors rounded-full flex items-center gap-2"
          >
            Open app
          </Link>
        </nav>
      </header>

      {/* Headline */}
      <div
        className="relative z-20 w-full max-w-4xl mt-auto md:mt-0 md:top-[-10%] animate-fade-in opacity-0 pointer-events-none"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-xs text-[#35E39C] uppercase tracking-[0.2em]">
            Stablecoin Settlement Network
          </span>
        </div>

        <h1 className="text-6xl md:text-8xl lg:text-9xl text-white leading-[0.9] tracking-tight font-medium text-balance">
          Send money
          <br />
          <span className="text-zinc-500">anywhere.</span>
        </h1>

        <p className="mt-8 max-w-md text-base md:text-lg text-zinc-400 font-light leading-relaxed">
          One gasless app to send, hold, earn, and settle money across borders.
          No seed phrase, no gas, no jargon; just money, the way you already think
          about it.
        </p>

        <div className="mt-10 flex items-center gap-6 pointer-events-auto">
          <a
            href="#waitlist"
            className="group flex items-center gap-3 bg-[#F5C451] text-[#06110d] px-6 py-3 rounded hover:bg-[#e6b53f] transition-all duration-300 font-semibold text-sm"
          >
            Get early access
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">
              Network Live
            </span>
          </div>
        </div>
      </div>

      {/* Corridor + tuner widgets */}
      <div
        className="pointer-events-auto absolute bottom-8 right-6 md:right-12 z-30 hidden lg:flex items-center animate-fade-in opacity-0"
        style={{ animationDelay: "0.5s" }}
      >
        <div className="w-48 tech-glass rounded-lg p-4 relative z-10 flex flex-col gap-3 mr-[-4px]">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-zinc-400" />
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest">
              Corridor_01
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>London → Lagos</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Settles</span>
              <span className="text-[#35E39C]">&lt;30 sec</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Fee</span>
              <span>0.5%</span>
            </div>
          </div>
          <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-zinc-950 border border-zinc-700 rounded-full z-20" />
        </div>

        <svg className="w-12 h-2 overflow-visible relative z-0">
          <path
            d="M0,4 C24,4 24,4 48,4"
            stroke="#35E39C"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="3 3"
            className="animate-flow"
          />
        </svg>

        <div className="w-[280px] tech-glass rounded-lg ml-[-4px] relative z-10">
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-zinc-950 border border-zinc-700 rounded-full z-20" />

          <div className="border-b border-zinc-800/60 px-4 py-3 flex justify-between items-center">
            <span className="font-mono text-xs text-white uppercase tracking-widest">
              Network Tuner
            </span>
            <Settings className="w-4 h-4 text-zinc-500" />
          </div>

          <div className="p-5 space-y-6">
            <Slider
              label="Signal Rate"
              value={controls.signalRate}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => set({ signalRate: v })}
            />
            <Slider
              label="Arc Reach"
              value={controls.dotSize}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(v) => set({ dotSize: v })}
            />

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60">
              <Slider
                label="Spin Speed"
                value={controls.spin}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => set({ spin: v })}
                compact
              />
              <Slider
                label="Glow"
                value={controls.glow}
                min={0.1}
                max={1}
                step={0.05}
                onChange={(v) => set({ glow: v })}
                compact
              />
            </div>

            <div className="pt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Accent
              </span>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={`Set accent ${c}`}
                    onClick={() => set({ color: c })}
                    className="w-4 h-4 rounded border border-transparent ring-1 ring-offset-2 ring-offset-[#09090b] transition-all hover:ring-zinc-600"
                    style={{
                      backgroundColor: c,
                      boxShadow:
                        controls.color === c ? `0 0 10px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 md:left-12 z-20 flex flex-col gap-1 opacity-60 pointer-events-none">
        <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
          {site.protocolVersion}
        </span>
        <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
          Gasless · Non-custodial
        </span>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div
        className={`flex justify-between font-mono tracking-widest text-zinc-500 uppercase ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        <span>{label}</span>
        {!compact && <span className="text-zinc-300">{value.toFixed(1)}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

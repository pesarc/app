// Landing design-system primitives, distilled from the coin-compass reference:
// pill nav items with a leading icon, and accent (Pesarc-blue) pill buttons with
// an optional circular icon badge. Rounded-full everywhere; icons are thin-line
// (lucide, the solar-linear equivalent). Accent = the logo blue.
import { type LucideIcon, ArrowUpRight } from "lucide-react";

export const ACCENT = "#3AA0FF"; // Pesarc logo blue
export const ON_ACCENT = "#04294d"; // text/icons on an accent fill

/** Pill nav link: active = solid white, inactive = outlined ghost. */
export function NavPill({
  icon: Icon,
  label,
  href,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 hover:scale-[1.03] ${
        active ? "text-[#0d2a12]" : "text-white/80 hover:text-white hover:bg-white/5"
      }`}
      style={active ? { background: "#ffffff" } : { border: "1px solid rgba(255,255,255,0.18)" }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
      {label}
    </a>
  );
}

/** Accent pill button. `badge` wraps the icon in a translucent circle (the
 *  coin-compass primary-CTA look); otherwise the icon sits inline. */
export function AccentButton({
  children,
  href,
  onClick,
  icon: Icon = ArrowUpRight,
  badge = false,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  badge?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm";
  const inner = (
    <>
      {badge ? (
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 18, height: 18, background: "rgba(4,41,77,0.15)" }}
        >
          <Icon className="w-3 h-3" strokeWidth={1.8} />
        </span>
      ) : (
        <Icon className="w-4 h-4" strokeWidth={1.8} />
      )}
      {children}
    </>
  );
  const cls = `inline-flex items-center gap-2 rounded-full font-medium transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] ${pad} ${className}`;
  const style = { backgroundColor: ACCENT, color: ON_ACCENT, boxShadow: "0 8px 24px -6px rgba(58,160,255,0.4)" };
  return href ? (
    <a href={href} className={cls} style={style}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  );
}

/** Outlined ghost pill (secondary), matching the nav's inactive look. */
export function GhostPill({
  children,
  href,
  icon: Icon,
}: {
  children: React.ReactNode;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/5 transition-colors"
      style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} strokeWidth={1.6} />}
      {children}
    </a>
  );
}

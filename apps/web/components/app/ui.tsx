import * as React from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]";
  const sizes = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-4 text-base",
  };
  const variants = {
    // Signature Relief CTA: sky fill + flat 7px sky pop-shadow (never a blur).
    primary:
      "bg-sky text-white hover:bg-sky-deep shadow-pop hover:-translate-y-0.5",
    secondary:
      "bg-snow text-harbor border border-fog hover:border-slate/50 shadow-card-flat",
    ghost: "text-sky hover:bg-sky-tint/50",
  };
  return (
    <button
      className={cx(
        base,
        sizes[size],
        variants[variant],
        block && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "bg-snow rounded-card shadow-card-flat border border-black/[0.04]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------------- Segmented toggle (Basic / Advanced etc.) ---------------- */

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  "aria-label"?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "rounded-full font-medium transition-all",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active
                ? "bg-snow text-ink shadow-card-flat"
                : "text-slate hover:text-ink"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Status beacon ---------------- */

export function StatusBeacon({
  status,
  label,
}: {
  status: "active" | "pending" | "done" | "alert";
  label: string;
}) {
  const colors = {
    active: "bg-sky",
    pending: "bg-harbor",
    done: "bg-success",
    alert: "bg-alert",
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx("w-2 h-2 rounded-full", colors[status])} />
      <span className="text-xs font-medium text-slate">{label}</span>
    </span>
  );
}

/* ---------------- Avatar ---------------- */

export function Avatar({
  initials,
  color,
  size = 40,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </span>
  );
}

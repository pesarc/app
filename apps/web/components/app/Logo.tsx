// Pesarc brand mark — a sky rounded-square badge with a white "P" and a small
// node hinting at the settlement flow. `LogoMark` is the badge alone (use it
// where space is tight, e.g. the collapsed sidebar); `Logo` pairs it with the
// wordmark.

import { site } from "@pesarc/sdk/site";

export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = "pesarc-mark-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={site.name}
      className={className}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3AA0FF" />
          <stop offset="1" stopColor="#1F7AE0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="9.6" y="7" width="4" height="18" rx="2" fill="#fff" />
      <path
        d="M11.6 9H16.5a5.6 5.6 0 0 1 0 11.2H11.6"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.4" cy="23.2" r="2.2" fill="#BFE0FF" />
    </svg>
  );
}

export function Logo({
  className = "",
  markSize = 32,
  wordmark = true,
}: {
  className?: string;
  markSize?: number;
  wordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} className="shrink-0" />
      {wordmark && (
        <span className="text-lg font-extrabold tracking-tight text-harbor">{site.name}</span>
      )}
    </span>
  );
}

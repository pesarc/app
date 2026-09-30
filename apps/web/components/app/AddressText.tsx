// Renders a wallet/account address with the first and last 6 characters bold, so
// users can quickly eyeball-match the ends (the part people actually verify)
// while the middle stays dimmed.

export function AddressText({ address, className = "" }: { address: string; className?: string }) {
  const a = address ?? "";
  if (a.length <= 12) return <span className={className}>{a}</span>;
  return (
    <span className={className}>
      <span className="font-bold text-ink">{a.slice(0, 6)}</span>
      <span className="opacity-50">{a.slice(6, -6)}</span>
      <span className="font-bold text-ink">{a.slice(-6)}</span>
    </span>
  );
}

// Countries we onboard, each mapped to its home currency. Picking a country on
// onboarding sets the default send currency (later superseded by what the user
// actually holds). Kept to markets we support plus the common sending countries.

import { SUPPORTED_CURRENCIES, type CurrencyCode } from "./money";

export type Country = { code: string; name: string; flag: string; currency: CurrencyCode };

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", currency: "ETB" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", currency: "MAD" },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  { code: "EU", name: "Eurozone", flag: "🇪🇺", currency: "EUR" },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD" },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD" },
];

/** Countries whose home currency we actually settle in — the set shown in the
 *  onboarding picker so a user's default currency is always one we support. */
export const SUPPORTED_COUNTRIES: Country[] = COUNTRIES.filter((c) =>
  (SUPPORTED_CURRENCIES as string[]).includes(c.currency),
);

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Countries that require BVN-style KYC for a bank payout account. */
export const BVN_COUNTRIES = new Set(["NG"]);

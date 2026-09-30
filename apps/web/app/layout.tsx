import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@pesarc/sdk/site";
import Analytics from "@/components/Analytics";
import EnvBadge from "@/components/app/EnvBadge";

// Self-hosted variable fonts (latin), committed under ./fonts. Self-hosting keeps
// the build offline — no Google Fonts fetch at build time, which was flaky and
// broke the container image build intermittently. One variable file per family
// covers every weight we use.
const manrope = localFont({
  src: "./fonts/Manrope.woff2",
  variable: "--font-sans",
  weight: "200 800",
  display: "swap",
});

// Display face for the coin-compass landing.
const geist = localFont({
  src: "./fonts/Geist.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

// Editorial serif for the display/italic headings across the landing. Wired as
// --font-serif so the landing's `var(--font-serif, Georgia)` usages resolve to
// an intentional face instead of falling back to Georgia.
const newsreader = localFont({
  src: [
    { path: "./fonts/Newsreader.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/Newsreader-Italic.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

// Never let a malformed site URL (e.g. a quoted env value) crash metadata
// resolution and 500 the app; fall back to the canonical domain.
function safeMetadataBase(): URL {
  try {
    return new URL(site.url);
  } catch {
    return new URL("https://pesarc.xyz");
  }
}

export const metadata: Metadata = {
  metadataBase: safeMetadataBase(),
  title: {
    default: `${site.name} — Send money home in seconds`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [...site.keywords],
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — Send, hold, earn and settle money across borders`,
    description: site.description,
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Send, hold, earn and settle money across borders`,
    description: site.description,
    images: [site.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android",
    description: site.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable} ${geist.variable} ${newsreader.variable} antialiased`}
    >
      <body className="overflow-x-clip">
        {children}
        <EnvBadge />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics />
      </body>
    </html>
  );
}

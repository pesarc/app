import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/landing/Footer";
import { LogoMark } from "@/components/app/Logo";
import { site } from "@pesarc/sdk/site";

// Shared shell for the marketing/legal pages (Privacy, Terms, Careers). Matches
// the landing's deep-navy surface so these pages feel like one site.
export default function PageShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-white [color-scheme:dark]"
      style={{
        background: "linear-gradient(160deg,#041a33 0%,#072a4d 45%,#041a33 100%)",
        fontFamily: "var(--font-geist), var(--font-sans), sans-serif",
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg,rgba(255,255,255,0.025) 0px,rgba(255,255,255,0.025) 1px,transparent 1px,transparent 56px)",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <header className="px-6 md:px-12 py-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={32} className="rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight text-white">{site.name}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back home
          </Link>
        </header>

        <main className="px-6 md:px-12 pt-8 pb-24">
          <div className="mx-auto max-w-3xl">
            <span
              className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-5"
              style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
            >
              {eyebrow}
            </span>
            <h1
              className="text-white text-4xl sm:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-serif, Georgia), serif", lineHeight: 1.05 }}
            >
              {title}
            </h1>
            {updated && (
              <p className="mt-4 text-[13px] font-medium text-white/40">Last updated {updated}</p>
            )}
            <div className="prose-pesarc mt-10">{children}</div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

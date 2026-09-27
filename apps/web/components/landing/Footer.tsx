import Link from "next/link";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const DOCS = "https://docs.pesarc.xyz";

type FLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Networks", href: "/#networks" },
      { label: "Beta access", href: "/#beta" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: DOCS, external: true },
      { label: "API reference", href: `${DOCS}/api-reference/introduction`, external: true },
      { label: "Integrations", href: `${DOCS}/integrations/overview`, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why Pesarc", href: "/#why" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "mailto:hello@pesarc.xyz", external: true },
    ],
  },
];

function FooterLink({ link }: { link: FLink }) {
  const cls = "text-sm font-medium text-white/70 hover:text-white transition-colors";
  if (link.external) {
    const isMail = link.href.startsWith("mailto:");
    return (
      <a href={link.href} className={cls} {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={cls}>
      {link.label}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer
      className="relative text-white pt-20 pb-10 px-6 md:px-12"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.18)" }}
    >
      <div className="max-w-7xl mx-auto grid gap-10 lg:grid-cols-5 lg:gap-8 mb-14">
        <div className="lg:col-span-2 flex flex-col items-start max-w-sm">
          <div className="flex items-center gap-3 mb-5">
            <LogoMark size={28} className="shrink-0 rounded-lg" />
            <span className="text-lg tracking-tight text-white font-extrabold">
              {site.name}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium leading-relaxed">
            One simple app to send, hold, earn and settle money across borders,
            in your own currency. Money the way you already think about it.
          </p>
        </div>

        {/* Link columns: 2-up on phones, 3-up on tablets, and on desktop
            `lg:contents` dissolves this wrapper so each column becomes a cell
            of the 5-col grid beside the brand. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:contents">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-extrabold text-white/50 uppercase tracking-widest mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs font-medium text-white/50">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <Link href="/privacy" className="text-xs font-medium text-white/50 hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-xs font-medium text-white/50 hover:text-white transition-colors">
            Terms
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

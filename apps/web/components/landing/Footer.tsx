import Link from "next/link";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Networks", href: "/#networks" },
      { label: "Beta access", href: "/#beta" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Security", href: "#" },
      { label: "Status", href: "#" },
      { label: "Blog", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Privacy Policy", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer
      className="relative text-white pt-20 pb-10 px-6 md:px-12"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.18)" }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
        <div className="lg:col-span-2 flex flex-col items-start">
          <div className="flex items-center gap-3 mb-6">
            <LogoMark size={28} className="shrink-0 rounded-lg" />
            <span className="text-lg tracking-tight text-white font-extrabold">
              {site.name}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium leading-relaxed max-w-xs mb-6">
            One gasless app to send, hold, earn, and settle money across
            borders. Money the way you already think about it.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11px] font-extrabold text-white/50 uppercase tracking-widest mb-4">
              {col.title}
            </h4>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs font-medium text-white/50">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </span>
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

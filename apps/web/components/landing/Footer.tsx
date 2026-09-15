import Link from "next/link";
import { site } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Send", href: "/send" },
      { label: "Earn", href: "/earn" },
      { label: "Business", href: "/business" },
      { label: "Pricing", href: "/#corridor" },
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
    <footer className="bg-[#09090b] pt-20 pb-10 px-6 md:px-12 relative z-20 border-t border-zinc-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
        <div className="lg:col-span-2 flex flex-col items-start">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-white text-black font-mono text-[10px] font-medium">
              SA
            </div>
            <span className="text-lg tracking-tight text-white font-medium">
              {site.name}
            </span>
          </div>
          <p className="text-sm text-zinc-500 font-light leading-relaxed max-w-xs mb-6">
            One gasless app to send, hold, earn, and settle money across
            borders. Money the way you already think about it.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-mono text-white uppercase tracking-widest mb-4">
              {col.title}
            </h4>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm font-light text-zinc-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-zinc-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs font-light text-zinc-600">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            All Systems Operational
          </span>
        </div>
      </div>
    </footer>
  );
}

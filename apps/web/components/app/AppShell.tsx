"use client";

// Responsive app shell.
//  • Large screens: a collapsible shadcn sidebar rail (icon-collapse, ⌘/Ctrl-B,
//    state persisted in a cookie) + a slim top bar with the collapse trigger.
//  • Mobile: a floating bottom tab bar (Home · Markets · raised Send · Agent ·
//    You) — five thumb targets, no hamburger.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, Bot, User, ArrowUpRight } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";

function readCookie(): boolean {
  if (typeof document === "undefined") return true;
  const m = document.cookie.match(/(?:^|;\s*)sidebar:state=(true|false)/);
  return m ? m[1] === "true" : true;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Restore the collapsed/expanded preference after mount (SSR-safe).
  useEffect(() => setOpen(readCookie()), []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} className="app-surface">
      <AppSidebar pathname={pathname} />

      <SidebarInset className="bg-cream">
        <header className="hidden md:flex items-center gap-3 h-14 px-4 sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-fog/70">
          <SidebarTrigger className="text-harbor" />
        </header>

        <div className="pb-28 md:pb-6">{children}</div>
      </SidebarInset>

      <BottomNav pathname={pathname} />
    </SidebarProvider>
  );
}

/* ---------------- Mobile bottom nav ---------------- */

const TABS = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Markets", href: "/markets", icon: BarChart3 },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "You", href: "/you", icon: User },
];

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-4 mb-4 h-[66px] rounded-pill bg-snow border border-fog shadow-[rgba(0,0,0,0.06)_0px_4px_0px_0px] flex items-center justify-around px-2">
        <TabItem item={TABS[0]} active={isActive(pathname, "/home")} />
        <TabItem item={TABS[1]} active={isActive(pathname, "/markets")} />

        <Link href="/send" aria-label="Send" className="flex flex-col items-center">
          <span className="w-[46px] h-[46px] -mt-6 rounded-full bg-sky text-white flex items-center justify-center shadow-[rgba(154,207,246,0.6)_0px_4px_0px_0px] active:translate-y-0.5 transition-transform">
            <ArrowUpRight className="w-6 h-6" />
          </span>
        </Link>

        <TabItem item={TABS[2]} active={isActive(pathname, "/agent")} />
        <TabItem item={TABS[3]} active={isActive(pathname, "/you")} />
      </div>
    </nav>
  );
}

function TabItem({
  item,
  active,
}: {
  item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 w-14 ${active ? "text-harbor" : "text-slate"}`}
    >
      <Icon className="w-[22px] h-[22px]" />
      <span className={`text-[11px] ${active ? "font-extrabold" : "font-semibold"}`}>
        {item.label}
      </span>
    </Link>
  );
}

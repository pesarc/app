"use client";

import Link from "next/link";
import {
  Home,
  BarChart3,
  Bot,
  User,
  ArrowUpRight,
  QrCode,
  ArrowDownLeft,
  Sprout,
  Building2,
  MapPin,
  Plus,
  LineChart,
} from "lucide-react";
import { site } from "@pesarc/sdk/site";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const MAIN: Item[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Send", href: "/send", icon: ArrowUpRight },
  { label: "Markets", href: "/markets", icon: BarChart3 },
  { label: "Agent", href: "/agent", icon: Bot },
];

const MONEY: Item[] = [
  { label: "Invest", href: "/invest", icon: LineChart },
  { label: "Earn", href: "/earn", icon: Sprout },
  { label: "Pay", href: "/pay", icon: QrCode },
  { label: "Receive", href: "/receive", icon: ArrowDownLeft },
  { label: "Add money", href: "/add", icon: Plus },
  { label: "Business", href: "/business", icon: Building2 },
  { label: "Local", href: "/corridor", icon: MapPin },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar({ pathname }: { pathname: string }) {
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2.5 px-1 py-1">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl bg-sky text-white font-extrabold text-sm shadow-pop-sm">
            P
          </span>
          <span className="text-lg font-extrabold tracking-tight text-harbor group-data-[collapsible=icon]:hidden">
            {site.name}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN.map((it) => (
                <NavItem key={it.href} item={it} active={isActive(pathname, it.href)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Money</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MONEY.map((it) => (
                <NavItem key={it.href} item={it} active={isActive(pathname, it.href)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountButton pathname={pathname} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href}>
          <Icon className="w-[18px] h-[18px]" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AccountButton({ pathname }: { pathname: string }) {
  const { mode, authenticated, address, alias } = useWallet();
  const label =
    mode === "mock"
      ? `${alias} · demo`
      : authenticated && address
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : "Sign in";

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive(pathname, "/you")}
      tooltip="You"
      size="lg"
    >
      <Link href="/you">
        <span className="w-8 h-8 shrink-0 rounded-full bg-harbor text-white flex items-center justify-center font-extrabold text-xs">
          {(alias?.replace("@", "")[0] ?? "Y").toUpperCase()}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-harbor">You</span>
          <span className="text-[11px] font-medium text-slate">{label}</span>
        </span>
      </Link>
    </SidebarMenuButton>
  );
}

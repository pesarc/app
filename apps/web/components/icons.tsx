"use client";

// Pesarc icon set — Hugeicons (stroke-rounded), the single source of truth.
//
// WHY THIS FILE EXISTS: `lucide-react` is banned (see CLAUDE.md) — it does not
// pass our design bar. Every icon in the app comes from here, wrapped from
// Hugeicons' `stroke-rounded` glyphs, and exposed with a lucide-compatible call
// shape so component code stays clean and the icon set is swappable in one place:
//
//     import { Send, Wallet } from "@/components/icons";
//     <Send className="w-5 h-5" strokeWidth={1.8} style={{ color: ACCENT }} />
//
// Sizing: pass Tailwind `w-*/h-*` (CSS wins over the SVG's width/height attrs),
// exactly like lucide. Color flows through `currentColor`, so `style={{ color }}`
// or a Tailwind `text-*` class tints the stroke. Need an icon that isn't here?
// Add one line below mapping it to its Hugeicons `*Icon` export — never import
// `@hugeicons/*` directly in a component.

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ComponentType, CSSProperties, MouseEventHandler } from "react";
import {
  AlertCircleIcon,
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  BanknoteIcon,
  ChartBarBigIcon,
  BellIcon,
  BotIcon,
  Building02Icon,
  Tick02Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock01Icon,
  Copy01Icon,
  Coins01Icon,
  DropletsIcon,
  ExternalLinkIcon,
  GaugeIcon,
  Globe02Icon,
  Home01Icon,
  InformationCircleIcon,
  BankIcon,
  Layers01Icon,
  DashboardSquare01Icon,
  ChartLineData01Icon,
  Link02Icon,
  Loading03Icon,
  LockIcon,
  PanelLeftIcon,
  PencilEdit02Icon,
  Call02Icon,
  PlusSignIcon,
  QrCodeIcon,
  RadioIcon,
  Route01Icon,
  Search01Icon,
  SentIcon,
  Share01Icon,
  Shield01Icon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  Plant02Icon,
  Store01Icon,
  Sun03Icon,
  Delete02Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserIcon,
  UserMultipleIcon,
  Wallet01Icon,
  WavesIcon,
  Cancel01Icon,
  ZapIcon,
  CheckmarkBadge01Icon,
  CameraOff01Icon,
  SourceCodeIcon,
  File01Icon,
  GlobeIcon,
  HashIcon,
  Key01Icon,
  Logout01Icon,
  MapPinIcon,
  Message01Icon,
  Mic01Icon,
  PiggyBankIcon,
  ReceiptIcon,
  RefreshIcon,
  ScanIcon,
  Settings02Icon,
  ShuffleIcon,
  SquareIcon,
  TerminalIcon,
  Wifi01Icon,
  AttachmentIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";

/** Lucide-compatible icon props. Kept minimal on purpose. */
export type IconProps = {
  className?: string;
  style?: CSSProperties;
  /** Stroke weight; our default is a designer-standard 1.8. */
  strokeWidth?: number;
  /** Numeric px size (Tailwind width/height classes also work and override this). */
  size?: number | string;
  /** Stroke color; defaults to `currentColor` so `text-*` / `style.color` tint it. */
  color?: string;
  onClick?: MouseEventHandler<SVGSVGElement>;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  role?: string;
};

/** Drop-in replacement for lucide's `LucideIcon` type. */
export type IconType = ComponentType<IconProps>;
/** Back-compat alias so `import { type LucideIcon }` keeps working during migration. */
export type LucideIcon = IconType;

function make(glyph: IconSvgElement): IconType {
  function Icon({ strokeWidth = 1.8, color = "currentColor", ...rest }: IconProps) {
    return <HugeiconsIcon icon={glyph} color={color} strokeWidth={strokeWidth} {...rest} />;
  }
  return Icon;
}

/* ---- The Pesarc icon set (lucide name -> Hugeicons stroke-rounded glyph) ---- */
export const AlertCircle = make(AlertCircleIcon);
export const ArrowDownLeft = make(ArrowDownLeft01Icon);
export const ArrowLeft = make(ArrowLeft01Icon);
export const ArrowRight = make(ArrowRight01Icon);
export const ArrowUp = make(ArrowUp01Icon);
export const ArrowUpRight = make(ArrowUpRight01Icon);
export const Banknote = make(BanknoteIcon);
export const BarChart3 = make(ChartBarBigIcon);
export const Bell = make(BellIcon);
export const Bot = make(BotIcon);
export const Building2 = make(Building02Icon);
export const Check = make(Tick02Icon);
export const ChevronDown = make(ChevronDownIcon);
export const ChevronLeft = make(ChevronLeftIcon);
export const ChevronRight = make(ChevronRightIcon);
export const Clock = make(Clock01Icon);
export const Coins = make(Coins01Icon);
export const Copy = make(Copy01Icon);
export const Droplets = make(DropletsIcon);
export const ExternalLink = make(ExternalLinkIcon);
export const Gauge = make(GaugeIcon);
export const Globe2 = make(Globe02Icon);
export const Home = make(Home01Icon);
export const Info = make(InformationCircleIcon);
export const Landmark = make(BankIcon);
export const Layers = make(Layers01Icon);
export const LayoutGrid = make(DashboardSquare01Icon);
export const LineChart = make(ChartLineData01Icon);
export const Link2 = make(Link02Icon);
export const Loader2 = make(Loading03Icon);
export const Lock = make(LockIcon);
export const PanelLeft = make(PanelLeftIcon);
export const Pencil = make(PencilEdit02Icon);
export const Phone = make(Call02Icon);
export const Plus = make(PlusSignIcon);
export const QrCode = make(QrCodeIcon);
export const Radio = make(RadioIcon);
export const Route = make(Route01Icon);
export const Search = make(Search01Icon);
export const Send = make(SentIcon);
export const Share2 = make(Share01Icon);
export const Shield = make(Shield01Icon);
export const ShieldCheck = make(ShieldCheckIcon);
export const Smartphone = make(SmartphoneIcon);
export const Sparkles = make(SparklesIcon);
export const Sprout = make(Plant02Icon);
export const Store = make(Store01Icon);
export const Sun = make(Sun03Icon);
export const Trash2 = make(Delete02Icon);
export const TrendingDown = make(TrendingDownIcon);
export const TrendingUp = make(TrendingUpIcon);
export const User = make(UserIcon);
export const Users = make(UserMultipleIcon);
export const Wallet = make(Wallet01Icon);
export const Waves = make(WavesIcon);
export const X = make(Cancel01Icon);
export const Zap = make(ZapIcon);
export const BadgeCheck = make(CheckmarkBadge01Icon);
export const CameraOff = make(CameraOff01Icon);
export const Code2 = make(SourceCodeIcon);
export const FileText = make(File01Icon);
export const Globe = make(GlobeIcon);
export const Hash = make(HashIcon);
export const KeyRound = make(Key01Icon);
export const LogOut = make(Logout01Icon);
export const MapPin = make(MapPinIcon);
export const MessageSquare = make(Message01Icon);
export const Mic = make(Mic01Icon);
export const PiggyBank = make(PiggyBankIcon);
export const Receipt = make(ReceiptIcon);
export const RefreshCw = make(RefreshIcon);
export const ScanLine = make(ScanIcon);
export const Settings2 = make(Settings02Icon);
export const Shuffle = make(ShuffleIcon);
export const Square = make(SquareIcon);
export const Terminal = make(TerminalIcon);
export const Wifi = make(Wifi01Icon);
export const Paperclip = make(AttachmentIcon);
export const ArrowDown = make(ArrowDown01Icon);

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { ActivityList } from "@/components/app/activity/ActivityList";

export const metadata: Metadata = {
  title: "History",
  description: "Every transaction across your chains and bank payouts, filterable by chain, token and type.",
};

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-6 md:py-10">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/home" aria-label="Back" className="w-9 h-9 rounded-full bg-black/[0.04] text-slate hover:text-ink flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-harbor leading-none">History</h1>
          <p className="text-[13px] text-slate mt-0.5">Every transaction, across chains and bank payouts.</p>
        </div>
      </div>
      <ActivityList mode="full" />
    </div>
  );
}

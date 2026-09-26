import type { Metadata } from "next";
import SettleFlow from "@/components/app/business/SettleFlow";
import RequireBusiness from "@/components/app/RequireBusiness";

export const metadata: Metadata = {
  title: "Business",
  description:
    "Record invoices between corporate members and settle the whole web in one multilateral netting cycle: only net positions move on-chain.",
};

export default function BusinessPage() {
  return (
    <RequireBusiness>
      <SettleFlow />
    </RequireBusiness>
  );
}

import type { Metadata } from "next";
import DevelopersView from "@/components/app/developers/DevelopersView";
import RequireBusiness from "@/components/app/RequireBusiness";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "Accept payments from your own app or site with the Pesarc API and an OPay-style hosted checkout that redirects customers back to you.",
};

export default function DevelopersPage() {
  return (
    <RequireBusiness>
      <DevelopersView />
    </RequireBusiness>
  );
}

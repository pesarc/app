import type { Metadata } from "next";
import SendFlow from "@/components/app/send/SendFlow";

export const metadata: Metadata = {
  title: "Send money",
  description:
    "Send money home in under a minute — gasless, to a contact or phone number, paid out to bank, mobile money, or an in-app balance.",
};

export default function SendPage() {
  return <SendFlow />;
}

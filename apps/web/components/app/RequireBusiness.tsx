"use client";

// Guards business-only surfaces: a retail persona that reaches one by direct URL
// is sent back to /home. Complements hiding it from the retail nav.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePersona } from "@pesarc/sdk/persona";

export default function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { persona, ready } = usePersona();
  const router = useRouter();

  useEffect(() => {
    if (ready && persona === "retail") router.replace("/home");
  }, [ready, persona, router]);

  if (ready && persona === "retail") return null;
  return <>{children}</>;
}

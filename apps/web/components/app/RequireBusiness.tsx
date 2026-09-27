"use client";

// Guards business-only surfaces: any NON-business persona (retail, provider,
// advanced) that reaches one by direct URL is sent to its own home. Complements
// hiding it from the retail nav.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePersona, homeFor } from "@pesarc/sdk/persona";

export default function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { persona, ready, isBusiness } = usePersona();
  const router = useRouter();
  const blocked = ready && persona !== null && !isBusiness;

  useEffect(() => {
    if (blocked) router.replace(homeFor(persona));
  }, [blocked, persona, router]);

  if (blocked) return null;
  return <>{children}</>;
}

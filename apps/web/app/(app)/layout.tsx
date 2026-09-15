import AppShell from "@/components/app/AppShell";
import { UIModeProvider } from "@pesarc/sdk/ui-mode";
import { PrefsProvider } from "@pesarc/sdk/prefs";
import { WalletProvider } from "@pesarc/sdk/wallet/WalletProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <UIModeProvider>
        <PrefsProvider>
          <AppShell>{children}</AppShell>
        </PrefsProvider>
      </UIModeProvider>
    </WalletProvider>
  );
}

import AppShell from "@/components/app/AppShell";
import AuthGate from "@/components/app/AuthGate";
import { UIModeProvider } from "@pesarc/sdk/ui-mode";
import { PrefsProvider } from "@pesarc/sdk/prefs";
import { WalletProvider } from "@pesarc/sdk/wallet/WalletProvider";
import { ActiveChainProvider } from "@pesarc/sdk/chain/activeChain";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveChainProvider>
      <WalletProvider>
        <UIModeProvider>
          <PrefsProvider>
            <AuthGate>
              <AppShell>{children}</AppShell>
            </AuthGate>
          </PrefsProvider>
        </UIModeProvider>
      </WalletProvider>
    </ActiveChainProvider>
  );
}

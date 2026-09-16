import AppShell from "@/components/app/AppShell";
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
            <AppShell>{children}</AppShell>
          </PrefsProvider>
        </UIModeProvider>
      </WalletProvider>
    </ActiveChainProvider>
  );
}

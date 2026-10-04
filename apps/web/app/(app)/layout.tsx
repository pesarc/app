import AppShell from "@/components/app/AppShell";
import AuthGate from "@/components/app/AuthGate";
import OnboardingGate from "@/components/app/OnboardingGate";
import ClipboardPrompt from "@/components/app/ClipboardPrompt";
import { UIModeProvider } from "@pesarc/sdk/ui-mode";
import { PrefsProvider } from "@pesarc/sdk/prefs";
import { PersonaProvider } from "@pesarc/sdk/persona";
import { WalletProvider } from "@pesarc/sdk/wallet/WalletProvider";
import { ActiveChainProvider } from "@pesarc/sdk/chain/activeChain";
import { FxRatesProvider } from "@pesarc/sdk/fx-rates";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveChainProvider>
      <WalletProvider>
        <FxRatesProvider>
        <UIModeProvider>
          <PrefsProvider>
            <PersonaProvider>
              <AuthGate>
                <OnboardingGate>
                  <AppShell>{children}</AppShell>
                  <ClipboardPrompt />
                </OnboardingGate>
              </AuthGate>
            </PersonaProvider>
          </PrefsProvider>
        </UIModeProvider>
        </FxRatesProvider>
      </WalletProvider>
    </ActiveChainProvider>
  );
}

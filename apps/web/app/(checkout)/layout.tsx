// Standalone hosted-checkout chrome: the wallet providers (so a customer can
// actually pay), but none of the app gate/shell. A merchant's customer lands
// here, sees what they are paying, and only signs in when they tap Pay.

import { WalletProvider } from "@pesarc/sdk/wallet/WalletProvider";
import { ActiveChainProvider } from "@pesarc/sdk/chain/activeChain";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveChainProvider>
      <WalletProvider>
        <div className="min-h-screen bg-cream text-ink">{children}</div>
      </WalletProvider>
    </ActiveChainProvider>
  );
}

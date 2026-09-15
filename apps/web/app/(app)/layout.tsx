import AppNav from "@/components/AppNav";
import { UIModeProvider } from "@pesarc/sdk/ui-mode";
import { WalletProvider } from "@pesarc/sdk/wallet/WalletProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <UIModeProvider>
        <div className="app-surface flex flex-col">
          <AppNav />
          <main className="flex-1">{children}</main>
        </div>
      </UIModeProvider>
    </WalletProvider>
  );
}

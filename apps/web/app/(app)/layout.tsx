import AppNav from "@/components/AppNav";
import { UIModeProvider } from "@/lib/ui-mode";
import { WalletProvider } from "@/lib/wallet/WalletProvider";

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

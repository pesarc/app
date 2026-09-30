// The bridge now lives inside /swap ("Cross-chain" tab). This route stays as a
// direct deep link to the same non-custodial CCTP mover.
import CrossChainBridge from "@/components/app/CrossChainBridge";

export default function BridgePage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="text-xl font-extrabold tracking-tight text-harbor mb-4">Bridge</h1>
      <CrossChainBridge />
    </div>
  );
}

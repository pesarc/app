"use client";

// Scan & Pay: point the camera at a Pesarc payment QR (or any wallet
// address QR), see who you're paying and the all-in fee, and settle in one
// tap. Live wallets pay for real on the hub chain; mock mode simulates.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CameraOff,
  ExternalLink,
  ScanLine,
  Zap,
  Paperclip,
} from "@/components/icons";
import { ACCOUNT } from "@pesarc/sdk/account";
import { formatMoney, formatNumber, currencyName } from "@pesarc/sdk/money";
import { applyLivePool, getQuote, type Quote } from "@pesarc/sdk/quote";
import {
  fetchLivePoolQuote,
  livePoolQuoteAvailable,
  type LivePoolQuote,
} from "@pesarc/sdk/chain/liveQuote";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { CONTRACTS_READY } from "@pesarc/sdk/chain/contracts";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveNetwork } from "@pesarc/sdk/chain/activeNetwork";
import { Button, Card } from "@/components/app/ui";
import { AddressText } from "@/components/app/AddressText";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";
import { authedPostJson } from "@pesarc/sdk/api/client";
import { payReference } from "@pesarc/sdk/reference";

type Target = {
  /** Payout address (when the QR carried one). */
  address?: `0x${string}`;
  /** Human name/alias to display. */
  label: string;
  /** Fixed amount requested by the QR, in USD. */
  amount?: number;
};

type Step = "scan" | "details" | "paying" | "done";

/** Parses a scanned QR payload into a payment target. */
function parseScan(raw: string): Target | null {
  const text = raw.trim();

  // Raw EVM address or ethereum: URI
  const addrMatch = text.match(/^(?:ethereum:)?(0x[0-9a-fA-F]{40})/);
  if (addrMatch) {
    const address = addrMatch[1] as `0x${string}`;
    return { address, label: `${address.slice(0, 6)}…${address.slice(-4)}` };
  }

  // Pesarc pay link: <origin>/pay?name=@alias&to=0x..&amount=.. (also accepts
  // the legacy /pay/<alias> path form).
  try {
    const url = new URL(text);
    if (!url.pathname.includes("/pay")) return null;
    const m = url.pathname.match(/\/pay\/([^/]+)/);
    const alias = m ? decodeURIComponent(m[1]) : "";
    const name = url.searchParams.get("name");
    const to = url.searchParams.get("to") || "";
    const amt = parseFloat(url.searchParams.get("amount") || "");
    const label = name || (alias ? `@${alias}` : "");
    if (!label && !/^0x[0-9a-fA-F]{40}$/.test(to)) return null;
    return {
      address: /^0x[0-9a-fA-F]{40}$/.test(to) ? (to as `0x${string}`) : undefined,
      label: label || `${to.slice(0, 6)}…${to.slice(-4)}`,
      amount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Decode a QR code from an uploaded image file (a screenshot or photo of a QR
 * shared over WhatsApp/social). Draws it to a canvas and runs jsQR. Returns the
 * raw payload string, or null if no QR was found.
 */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const jsQR = (await import("jsqr")).default;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("load failed"));
      im.src = url;
    });
    // Cap the working size so a large photo stays fast.
    const maxDim = 1400;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height) || 1);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return jsQR(data.data, w, h)?.data ?? null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PayPage() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  // Solana selected → skip the EVM smart-wallet execution and use the
  // simulated path (real execution stays on the EVM/Arc leg).
  const { isSvm } = useActiveNetwork();
  const live =
    mode === "live" && authenticated && smart.ready && CONTRACTS_READY && !isSvm;

  const [step, setStep] = useState<Step>("scan");
  const [target, setTarget] = useState<Target | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [manual, setManual] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ tx?: string; payoutTx?: string; received?: number }>();

  const amount = target?.amount ?? (parseFloat(amountStr) || 0);

  const onScanned = useCallback((raw: string) => {
    const t = parseScan(raw);
    if (!t) return false;
    setTarget(t);
    setStep("details");
    return true;
  }, []);

  // Upload a QR image (screenshot/photo shared over social) instead of scanning
  // live. Decodes it, then routes into the same confirm-before-pay flow.
  const onUploadFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploadError(null);
      const raw = await decodeQrFromImage(file);
      if (!raw) {
        setUploadError("No QR code found in that image. Try a clearer screenshot.");
        return;
      }
      if (!onScanned(raw)) {
        setUploadError("That QR isn't a Pesarc payment code or a wallet address.");
      }
    },
    [onScanned],
  );

  // Deep link from a Receive link/QR: /pay?name=@alias&to=0x..&amount=..
  // Pre-fill the target and skip straight to the details step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    if (!search || !/[?&](name|to|amount)=/.test(search)) return;
    const t = parseScan(`${window.location.origin}/pay${search}`);
    if (t) {
      setTarget(t);
      if (t.amount) setAmountStr(String(t.amount));
      setStep("details");
    }
  }, []);

  /* ---- live quote (oracle mid + exact pool output) ---- */
  const [livePool, setLivePool] = useState<LivePoolQuote | null>(null);
  useEffect(() => {
    setLivePool(null);
    if (!livePoolQuoteAvailable() || amount <= 0 || step !== "details") return;
    let stale = false;
    const t = setTimeout(() => {
      fetchLivePoolQuote(amount).then((q) => !stale && setLivePool(q));
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [amount, step]);

  const quote: Quote | null = useMemo(() => {
    if (!target || amount <= 0) return null;
    const mock = getQuote({
      sendAmount: amount,
      sendCurrency: ACCOUNT.currency,
      receiveCurrency: "NGN",
      payout: "wallet",
    });
    return livePool ? applyLivePool(mock, livePool) : mock;
  }, [target, amount, livePool]);

  const pay = useCallback(async () => {
    if (!target || !quote) return;
    setStep("paying");
    try {
      const r = live
        ? await executeCorridorSend(smart, amount, target.address ?? "")
        : await new Promise<typeof result>((res) =>
            setTimeout(() => res({}), 1800)
          );
      setResult(r);
    } catch {
      setResult({});
    }
    setStep("done");
    // Record the payment (best-effort).
    authedPostJson("/api/transfers", {
        direction: "sent",
        counterparty: target.label,
        sendAmount: amount,
        sendCurrency: ACCOUNT.currency,
        receiveAmount: quote.receiveAmount,
        receiveCurrency: "NGN",
        payout: "QR payment",
        reference: payReference(),
      }).catch(() => {});
  }, [target, quote, live, smart, amount]);

  const reset = () => {
    setTarget(null);
    setAmountStr("");
    setResult(undefined);
    setStep("scan");
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Scan &amp; pay
        </h1>
        <NetworkSwitcher className="mt-1" />
      </div>
      <p className="text-slate mb-6">
        Point at a Pesarc QR, see who you&apos;re paying and the fee, then
        pay in one tap.
      </p>

      {step === "scan" && (
        <>
          <Scanner onScanned={onScanned} onError={() => setCameraError(true)} />
          {cameraError && (
            <Card className="p-4 mt-4 flex items-center gap-3 text-sm text-slate">
              <CameraOff className="w-4 h-4 shrink-0" />
              Camera unavailable. Paste a payment link or address instead.
            </Card>
          )}
          <div className="mt-4 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Paste address or pay link"
              aria-label="Payment link or address"
              className="flex-1 bg-snow rounded-field border border-fog px-4 py-3 text-sm text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50"
            />
            <Button
              onClick={() => manual && onScanned(manual)}
              disabled={!manual}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Upload a QR image shared over WhatsApp/social */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onUploadFile(e.target.files?.[0]);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-field border border-fog bg-snow px-4 py-3 text-sm font-medium text-ink shadow-card-flat hover:border-sky/50 transition"
          >
            <Paperclip className="w-4 h-4 text-slate" /> Upload a QR image
          </button>
          {uploadError && (
            <p className="mt-2 text-sm text-alert font-medium text-center">{uploadError}</p>
          )}
        </>
      )}

      {step === "details" && target && (
        <div className="animate-step-in">
          <Card className="p-6 mb-4">
            <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
              Paying
            </div>
            <div className="text-2xl font-semibold text-ink mb-1">
              {target.label}
            </div>
            {target.address && (
              <AddressText
                address={target.address}
                className="block font-mono text-xs text-slate break-all"
              />
            )}
          </Card>

          {target.amount === undefined && (
            <div className="text-center py-3 mb-2">
              <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-2">
                Amount
              </label>
              <div className="flex items-center justify-center gap-1">
                <span className="text-3xl font-semibold text-ink/40">$</span>
                <input
                  value={amountStr}
                  onChange={(e) =>
                    setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  aria-label="Amount to pay"
                  className="w-[5ch] bg-transparent text-5xl font-semibold text-ink text-center outline-none numerals placeholder:text-ink/25"
                />
              </div>
            </div>
          )}

          {quote && (
            <Card className="p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate">They receive</span>
                <span className="font-semibold text-sky numerals">
                  {formatMoney(quote.receiveAmount, "NGN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Fee</span>
                <span className="font-medium text-ink">
                  {(quote.feePct * 100).toFixed(2)}%
                  {quote.live ? (
                    <span className="text-sky font-medium"> · live</span>
                  ) : (
                    <span className="text-slate/70 font-medium"> · indicative</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Rate</span>
                <span className="font-medium text-ink numerals">
                  1 USD = {formatNumber(quote.effectiveRate, "NGN")} NGN
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate pt-1">
                <Zap className="w-3.5 h-3.5 text-sky" /> No fees · settles
                in seconds
              </div>
            </Card>
          )}

          <Button size="lg" block disabled={!quote} onClick={pay}>
            Pay {amount > 0 ? formatMoney(amount, ACCOUNT.currency) : ""}
          </Button>
          <button
            onClick={reset}
            className="w-full mt-3 text-sm font-medium text-slate hover:text-ink transition"
          >
            Scan a different code
          </button>
        </div>
      )}

      {step === "paying" && (
        <Card className="p-8 flex flex-col items-center gap-3 animate-step-in">
          <span className="w-10 h-10 rounded-full bg-sky-tint text-sky flex items-center justify-center animate-progress-pulse">
            <ScanLine className="w-5 h-5" />
          </span>
          <div className="font-medium text-ink">
            {live ? "Sending…" : "Processing payment…"}
          </div>
          <div className="text-xs text-slate">No fees</div>
        </Card>
      )}

      {step === "done" && target && quote && (
        <div className="text-center animate-step-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-sky flex items-center justify-center mb-5 shadow-pop-sm">
            <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-semibold text-ink mb-1">
            Paid {formatMoney(amount, ACCOUNT.currency)}
          </h2>
          <p className="text-slate mb-6">to {target.label}</p>

          <Card className="p-5 text-left mb-5 space-y-0">
            <RowLine label="They receive">
              {result?.received !== undefined
                ? `${result.received.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })} ${currencyName("NGN")}`
                : formatMoney(quote.receiveAmount, "NGN")}
            </RowLine>
            {result?.tx && (
              <RowLine label="Proof">
                <a
                  href={explorerTxUrl(result.tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
                >
                  View tx <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </RowLine>
            )}
            {result?.payoutTx && (
              <RowLine label="Paid out">
                <a
                  href={explorerTxUrl(result.payoutTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
                >
                  Recipient tx <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </RowLine>
            )}
          </Card>

          <Button block onClick={reset}>
            Pay someone else
          </Button>
        </div>
      )}
    </div>
  );
}

function RowLine({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[15px] border-b border-black/[0.06] last:border-0">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}

/* ---------------- Camera QR scanner ---------------- */

function Scanner({
  onScanned,
  onError,
}: {
  /** Return true when the payload was accepted (stops the loop). */
  onScanned: (raw: string) => boolean;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) return;
        video.srcObject = stream;
        await video.play();

        // Native detector where available, jsQR everywhere else.
        const Detector = (window as any).BarcodeDetector;
        const detector = Detector
          ? new Detector({ formats: ["qr_code"] })
          : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        timer = setInterval(async () => {
          if (stopped || video.readyState < 2) return;
          try {
            let raw: string | undefined;
            if (detector) {
              const codes = await detector.detect(video);
              raw = codes[0]?.rawValue;
            } else if (jsQR && ctx) {
              const w = Math.min(video.videoWidth, 640);
              const h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              raw = jsQR(img.data, w, h)?.data;
            }
            if (raw && onScanned(raw)) {
              stopped = true;
              if (timer) clearInterval(timer);
            }
          } catch {
            /* keep scanning */
          }
        }, 160);
      } catch {
        if (!stopped) onError();
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScanned, onError]);

  return (
    <div className="relative rounded-card overflow-hidden bg-black aspect-square shadow-pop-sm">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <div className="absolute bottom-4 inset-x-0 text-center text-white/90 text-sm font-medium pointer-events-none">
        <span className="inline-flex items-center gap-1.5">
          <ScanLine className="w-4 h-4" /> Align the QR inside the frame
        </span>
      </div>
    </div>
  );
}

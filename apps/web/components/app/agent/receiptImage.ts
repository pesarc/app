"use client";

// Render an agent receipt to a branded PNG the user can download and share.
// Pure canvas, no dependencies. Draws the Pesarc wordmark, the action title and
// status, every line, the reference and transaction hash, and a footer.

import type { AgentReceipt } from "@pesarc/sdk/agent/run";

const NAVY = "#0c2a47";
const INK = "#0f2233";
const SLATE = "#5b6b7b";
const GREEN = "#0f8a6b";
const AMBER = "#a97b12";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw the receipt and return a PNG blob (2x for crisp retina output). */
export async function receiptToPng(receipt: AgentReceipt): Promise<Blob> {
  const s = 2; // scale
  const W = 640;
  const padX = 40;
  const rows = receipt.lines.length;
  const extras =
    (receipt.reference ? 1 : 0) + (receipt.txHash ? 1 : 0) + (receipt.settlements?.length ?? 0);
  const H = 250 + rows * 40 + extras * 30 + 70;

  const canvas = document.createElement("canvas");
  canvas.width = W * s;
  canvas.height = H * s;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(s, s);

  const done = receipt.status !== "pending";
  const accent = done ? GREEN : AMBER;

  // Card + accent band.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // Brand wordmark.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = NAVY;
  ctx.font = "800 24px Manrope, system-ui, sans-serif";
  ctx.fillText("Pesarc", padX, 58);
  ctx.fillStyle = SLATE;
  ctx.font = "600 13px Manrope, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Receipt", W - padX, 56);
  ctx.textAlign = "left";

  // Title + status.
  ctx.fillStyle = INK;
  ctx.font = "800 22px Manrope, system-ui, sans-serif";
  ctx.fillText(receipt.title, padX, 108);
  ctx.fillStyle = accent;
  ctx.font = "700 14px Manrope, system-ui, sans-serif";
  ctx.fillText(done ? "Completed" : "Matching, settles automatically", padX, 134);

  // Dashed divider.
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(padX, 158);
  ctx.lineTo(W - padX, 158);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lines.
  let y = 196;
  for (const l of receipt.lines) {
    ctx.fillStyle = SLATE;
    ctx.font = "600 15px Manrope, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(l.label, padX, y);
    ctx.fillStyle = INK;
    ctx.font = "800 15px Manrope, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(l.value, W - padX, y);
    y += 40;
  }

  // Reference + hash + settlements (mono, wrapped).
  ctx.textAlign = "left";
  const mono = (label: string, value: string) => {
    ctx.fillStyle = SLATE;
    ctx.font = "700 11px Manrope, system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), padX, y);
    ctx.fillStyle = INK;
    ctx.font = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    const parts = wrap(ctx, value, W - padX * 2 - 90);
    ctx.fillText(parts[0], padX + 90, y);
    y += 30;
  };
  if (receipt.reference) mono("Reference", receipt.reference);
  if (receipt.txHash) mono("Tx hash", receipt.txHash);
  receipt.settlements?.forEach((st) => mono(`Settlement`, st.kind));

  // Footer.
  ctx.fillStyle = SLATE;
  ctx.font = "500 11px Manrope, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Amounts are on-chain. Settled peer-to-peer in local currency.", padX, H - 34);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleString(), W - padX, H - 34);
  ctx.textAlign = "left";
  ctx.fillStyle = NAVY;
  ctx.font = "700 11px Manrope, system-ui, sans-serif";
  ctx.fillText("pesarc.xyz", padX, H - 16);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render receipt"))), "image/png");
  });
}

/** Render + trigger a download of the receipt PNG. */
export async function downloadReceipt(receipt: AgentReceipt): Promise<void> {
  const blob = await receiptToPng(receipt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ref = (receipt.reference ?? receipt.kind).replace(/[^a-z0-9-]/gi, "");
  a.download = `pesarc-receipt-${ref}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

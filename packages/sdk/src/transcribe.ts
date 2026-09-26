// Speech-to-text seam for voice notes (WhatsApp today, others later). Provider-
// agnostic but shaped for an OpenAI-compatible /audio/transcriptions endpoint.
// Env-gated: with no key it returns null and callers fall back to asking the
// user to type. This is the last [!] to unblock for WhatsApp voice — set the
// key and it works.
//
// Env:
//   TRANSCRIBE_API_KEY   provider key
//   TRANSCRIBE_URL       endpoint (default OpenAI: https://api.openai.com/v1/audio/transcriptions)
//   TRANSCRIBE_MODEL     model id (default whisper-1)

export function transcribeConfigured(): boolean {
  return Boolean(process.env.TRANSCRIBE_API_KEY);
}

const DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions";

/** Transcribe audio bytes to text. Null when unconfigured or on failure. */
export async function transcribeAudio(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!key) return null;
  const url = process.env.TRANSCRIBE_URL || DEFAULT_URL;
  const model = process.env.TRANSCRIBE_MODEL || "whisper-1";
  try {
    const ext = mimeType.includes("mp3")
      ? "mp3"
      : mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "m4a"
          : "ogg";
    const form = new FormData();
    // Cast: some TS lib versions type Uint8Array as Uint8Array<ArrayBufferLike>,
    // which isn't seen as a BlobPart though it is a valid ArrayBufferView.
    form.append("file", new Blob([bytes as unknown as BlobPart], { type: mimeType }), `audio.${ext}`);
    form.append("model", model);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text.length ? text : null;
  } catch {
    return null;
  }
}

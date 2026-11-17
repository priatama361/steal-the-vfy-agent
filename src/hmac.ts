import crypto from "node:crypto";

export const SIGNATURE_HEADER = "x-agent-games-signature";
export type SignatureFormat = "hex" | "sha256=" | "base64";

/**
 * Spek tidak mempublikasikan encoding, jadi kita terima hex, "sha256=<hex>",
 * dan base64. Response dikirim dengan format yang sama dengan request.
 */
export function sign(secret: string, raw: Buffer, format: SignatureFormat = "hex"): string {
  const mac = crypto.createHmac("sha256", secret).update(raw);
  if (format === "base64") return mac.digest("base64");
  const hex = mac.digest("hex");
  return format === "sha256=" ? `sha256=${hex}` : hex;
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/** Mengembalikan format yang cocok, atau null jika signature tidak valid. */
export function verify(secret: string, raw: Buffer, header: string | string[] | undefined): SignatureFormat | null {
  if (!secret || typeof header !== "string" || !header) return null;
  const h = header.trim();
  const digest = crypto.createHmac("sha256", secret).update(raw).digest();
  const hex = digest.toString("hex");

  // Evaluasi semua kandidat tanpa early-exit agar waktu relatif seragam.
  let matched: SignatureFormat | null = null;
  if (safeEqual(h.toLowerCase(), hex)) matched = "hex";
  if (safeEqual(h.toLowerCase(), `sha256=${hex}`)) matched = "sha256=";
  if (safeEqual(h, digest.toString("base64"))) matched = "base64";
  return matched;
}

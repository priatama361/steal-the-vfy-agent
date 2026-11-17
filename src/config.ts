import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");

export const PORT = Number(process.env.PORT || 8787);
export const HMAC_SECRET = process.env.AGENT_GAMES_HMAC_SECRET || "";
export const STRATEGY_SALT = process.env.STRATEGY_SALT || "";
export const KURIER_API_KEY = process.env.KURIER_API_KEY || "";

export const PROOF_TIMEOUT_MS = Number(process.env.PROOF_TIMEOUT_MS || 15000);
export const ZKVERIFY_SUBMIT = (process.env.ZKVERIFY_SUBMIT || "false").toLowerCase() === "true";
export const ZKVERIFY_SUBMIT_TIMEOUT_MS = Number(process.env.ZKVERIFY_SUBMIT_TIMEOUT_MS || 2000);
export const MAX_BODY_BYTES = 1 << 20;

export const VK_HASH = "0x6c56509f1c56fd1fd4e9737f906d2220f4b95f1d507f1adf6899085bd74be047";
export const WASM_PATH = path.join(CIRCUITS_DIR, "vfy-policy.wasm");
export const ZKEY_PATH = path.join(CIRCUITS_DIR, "vfy-policy_final.zkey");
export const VKEY_PATH = path.join(CIRCUITS_DIR, "vfy-policy_vkey.json");

/**
 * ============================================================================
 * TODO(STRATEGY) — PARAMETER STRATEGI ANDA SENDIRI
 * ============================================================================
 * Nilai dimuat dari environment variable STRATEGY_PARAMS (lihat .env.example).
 * JANGAN menaruh nilai sungguhan di source code / git — parameter dan salt
 * adalah keunggulan kompetitif Anda dan harus tetap rahasia.
 *
 * Format 8 parameter yang di-enforce sirkuit resmi vfy-policy:
 *   [ extractAmount(1..10),
 *     fortifyIfSelfBelow,      // selfBalance < p[1] -> FORTIFY
 *     holdIfOppAtMost,         // opponentBalance <= p[2] -> HOLD
 *     alwaysHold(0/1),         // p[3] === 1 -> HOLD
 *     0, 0, 0, 0 ]             // p[4..7] WAJIB 0 menurut sirkuit
 *
 * Saya sengaja TIDAK mengisi nilai "bagus" untuk Anda. Isi sendiri di .env,
 * lalu hitung commitment dengan: npm run commitment
 * ============================================================================
 */
function loadStrategyParams(): bigint[] {
  const raw = (process.env.STRATEGY_PARAMS || "").trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => BigInt(v));
  } catch {
    return [];
  }
}

export const STRATEGY_PARAMS: bigint[] = loadStrategyParams();

/** Parameter dianggap siap pakai hanya jika valid menurut sirkuit. */
export function isStrategyConfigured(p: bigint[] = STRATEGY_PARAMS): boolean {
  return (
    p.length === 8 &&
    p[0] >= 1n &&
    p[0] <= 10n &&
    p[4] === 0n &&
    p[5] === 0n &&
    p[6] === 0n &&
    p[7] === 0n
  );
}

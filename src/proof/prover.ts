import fs from "node:fs/promises";
import * as snarkjs from "snarkjs";
import { PROOF_TIMEOUT_MS, VKEY_PATH, WASM_PATH, ZKEY_PATH } from "../config";
import { QUIET } from "../utils/logger";
import type { CircuitInput, Groth16Proof } from "../types";

export interface ProofResult {
  proof: Groth16Proof;
  public_signals: string[];
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Groth16 proof lokal + verifikasi lokal terhadap VK resmi event. */
export async function prove(input: CircuitInput): Promise<ProofResult> {
  return withTimeout(
    (async () => {
      const vkey = JSON.parse(await fs.readFile(VKEY_PATH, "utf8"));
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input as unknown as Record<string, unknown>,
        WASM_PATH,
        ZKEY_PATH,
        QUIET
      );
      const ok = await snarkjs.groth16.verify(
        vkey,
        publicSignals,
        proof as unknown as Record<string, unknown>,
        QUIET
      );
      if (!ok) throw new Error("verifikasi proof lokal gagal");
      return { proof: proof as Groth16Proof, public_signals: publicSignals };
    })(),
    PROOF_TIMEOUT_MS,
    "proof"
  );
}

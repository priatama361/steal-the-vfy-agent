import { KURIER_API_KEY, VK_HASH, ZKVERIFY_SUBMIT, ZKVERIFY_SUBMIT_TIMEOUT_MS } from "../config";
import { QUIET, log } from "../utils/logger";
import type { Groth16Proof } from "../types";

const API_URL = "https://api.kurier.xyz/api/v1";
void QUIET;

export interface KurierJob {
  jobId: string;
  status?: string;
  txHash?: string;
}

/**
 * OPSIONAL: submit proof ke zkVerify via Kurier untuk audit pointer.
 * Platform sudah re-verifies proof secara offline, jadi ini TIDAK boleh
 * mem-blok response turn. Modul ini tidak pernah melempar error.
 */
export async function submitProof(
  proof: Groth16Proof,
  publicSignals: string[]
): Promise<KurierJob | null> {
  if (!ZKVERIFY_SUBMIT || !KURIER_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZKVERIFY_SUBMIT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/submit-proof/${KURIER_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        proofType: "groth16",
        vkRegistered: true,
        proofOptions: { library: "snarkjs", curve: "bn128" },
        proofData: { proof, publicSignals, vk: VK_HASH },
      }),
    });
    if (!res.ok) {
      log("kurier-error", { http: res.status });
      return null;
    }
    const job = (await res.json()) as { jobId?: string };
    if (!job.jobId) {
      log("kurier-error", { why: "missing jobId" });
      return null;
    }
    log("kurier-submitted", { jobId: job.jobId });
    // Finalisasi dipantau di background; tidak mem-blok response.
    void pollFinalized(job.jobId).catch(() => {});
    return { jobId: job.jobId, status: "Submitted" };
  } catch {
    log("kurier-error", { why: "submit failed" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pollFinalized(jobId: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${API_URL}/job-status/${KURIER_API_KEY}/${jobId}`);
    if (!res.ok) continue;
    const status = (await res.json()) as { status?: string; txHash?: string };
    if (status.txHash) log("kurier-tx", { jobId, txHash: status.txHash });
    if (status.status === "Finalized" || status.status === "Failed") {
      log("kurier-final", { jobId, status: status.status });
      return;
    }
  }
  log("kurier-final", { jobId, status: "timeout" });
}

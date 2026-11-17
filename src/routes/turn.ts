import crypto from "node:crypto";
import { isStrategyConfigured, STRATEGY_PARAMS, STRATEGY_SALT } from "../config";
import { computeCommitment } from "../strategy/commitment";
import { actionAmount, actionCode, policy } from "../strategy/policy";
import { matchIdField, modP, parseAmount, saltField } from "../proof/field";
import { publicInputsHash } from "../proof/publicInputs";
import { prove } from "../proof/prover";
import { submitProof } from "../zkverify/kurier";
import { log } from "../utils/logger";
import type { CircuitInput, Groth16Proof, TurnEnvelope, TurnResponse } from "../types";

function idempotencyKey(matchId: string, turn: number, mode?: string): string {
  const h = crypto
    .createHash("sha256")
    .update(`steal:${mode || "competition"}:${matchId}:${turn}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Fail closed: HOLD tanpa proof bila ada keraguan/error. */
function holdNoProof(env: TurnEnvelope, why: string): TurnResponse {
  log("steal-hold", {
    matchId: env.matchId,
    turn: env.turn,
    why: String(why).slice(0, 120),
  });
  return {
    matchId: env.matchId,
    turn: env.turn,
    action: { type: "HOLD" },
    policyProof: { circuitVersion: "v1" } as TurnResponse["policyProof"],
    agentTimestamp: new Date().toISOString(),
    idempotencyKey: idempotencyKey(env.matchId, env.turn, env.mode),
  };
}

export async function handleTurn(env: TurnEnvelope): Promise<TurnResponse> {
  const base = { matchId: env.matchId, turn: env.turn };

  try {
    if (!env.matchId || env.turn === undefined || !env.state) {
      return holdNoProof(env, "invalid envelope");
    }
    if (!isStrategyConfigured()) {
      return holdNoProof(env, "STRATEGY_PARAMS belum diisi (TODO)");
    }
    if (!STRATEGY_SALT) {
      return holdNoProof(env, "STRATEGY_SALT belum diisi");
    }

    const self = parseAmount(env.state.selfBalance);
    const opp = parseAmount(env.state.opponentBalance);
    const turn = Number(env.turn);
    if (!Number.isSafeInteger(turn) || turn < 0) {
      return holdNoProof(env, "invalid turn");
    }

    const localCommitment = await computeCommitment(STRATEGY_PARAMS, STRATEGY_SALT);
    const envelopeHash = env.strategyCommitment?.hash;
    const commitment = envelopeHash
      ? modP(BigInt(envelopeHash))
      : localCommitment;

    if (envelopeHash && commitment !== localCommitment) {
      log("steal-warn", {
        matchId: env.matchId,
        turn,
        msg: "commitment envelope != lokal (daftarkan ulang commitment di dashboard?)",
      });
    }

    const action = policy(self, opp, STRATEGY_PARAMS);
    const code = actionCode(action);
    const amount = actionAmount(action);

    const input: CircuitInput = {
      commitment: commitment.toString(),
      matchId: matchIdField(env.matchId).toString(),
      turnNumber: String(turn),
      selfBalance: self.toString(),
      opponentBalance: opp.toString(),
      action: code.toString(),
      amount: amount.toString(),
      circuitVersion: "1",
      salt: saltField(STRATEGY_SALT).toString(),
      strategyParams: STRATEGY_PARAMS.map(String),
    };

    const t0 = Date.now();
    const { proof, public_signals } = await prove(input);
    log("steal-proof", {
      matchId: env.matchId,
      turn,
      action: action.type,
      ms: Date.now() - t0,
    });

    const pih = publicInputsHash({
      commitment,
      matchId: env.matchId,
      turn,
      selfBalance: self,
      opponentBalance: opp,
      action: action.type,
      amount,
    });

    // Opsional, fire-and-forget: jangan pernah tunggu Finalized di sini.
    const job = await submitProof(proof as Groth16Proof, public_signals);

    return {
      ...base,
      action:
        action.type === "EXTRACT"
          ? { type: "EXTRACT", amount: Number(amount) }
          : { type: action.type },
      policyProof: {
        circuitVersion: "v1",
        proof,
        public_signals,
        publicInputsHash: pih,
        ...(job?.txHash ? { proofReference: job.txHash } : {}),
      },
      agentTimestamp: new Date().toISOString(),
      idempotencyKey: idempotencyKey(env.matchId, turn, env.mode),
    };
  } catch (err) {
    return holdNoProof(env, `error: ${(err as Error).message}`);
  }
}

export function isTurnEnvelope(value: unknown): value is TurnEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.matchId === "string" &&
    typeof v.turn === "number" &&
    !!v.state &&
    typeof v.state === "object"
  );
}

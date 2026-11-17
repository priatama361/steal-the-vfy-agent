import { STRATEGY_PARAMS } from "../config";
import type { AgentAction } from "../types";

/**
 * Aturan keputusan yang DITETAPKAN OLEH SIRKUIT resmi vfy-policy.
 * Ini bukan "strategi Anda" — strategi Anda ada pada 8 parameter STRATEGY_PARAMS.
 *
 * Urutan yang di-enforce sirkuit:
 *   1) selfBalance < p[1]                       -> FORTIFY
 *   2) opponentBalance <= p[2] || p[3] === 1    -> HOLD
 *   3) selain itu                               -> EXTRACT sebesar p[0]
 *
 * Fungsi ini sengaja murni dan deterministik supaya cocok persis dengan sirkuit.
 */
export const ACTION_CODE = { HOLD: 0n, FORTIFY: 1n, EXTRACT: 2n } as const;

export function policy(
  selfBalance: bigint,
  opponentBalance: bigint,
  p: bigint[] = STRATEGY_PARAMS
): AgentAction {
  if (selfBalance < p[1]) return { type: "FORTIFY" };
  if (opponentBalance <= p[2] || p[3] === 1n) return { type: "HOLD" };
  return { type: "EXTRACT", amount: Number(p[0]) };
}

export function actionCode(action: AgentAction): bigint {
  return ACTION_CODE[action.type];
}

export function actionAmount(action: AgentAction): bigint {
  return action.type === "EXTRACT" ? BigInt(action.amount) : 0n;
}

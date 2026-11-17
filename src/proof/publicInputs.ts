import { concat, keccak256, numberToHex } from "viem";
import { ACTION_CODE } from "../strategy/policy";
import { idField, matchIdField } from "./field";

export interface PublicInputsArgs {
  commitment: bigint;
  matchId: string;
  turn: number;
  selfBalance: bigint;
  opponentBalance: bigint;
  action: keyof typeof ACTION_CODE;
  amount: bigint;
}

/**
 * keccak256 dari 8 field ABI-packed (32-byte big-endian) sesuai /build.
 * Urutan WAJIB: commitment, matchId, turn, self, opponent, action, amount, 1.
 */
export function publicInputsHash(args: PublicInputsArgs): `0x${string}` {
  const fields: bigint[] = [
    args.commitment,
    matchIdField(args.matchId),
    BigInt(args.turn),
    args.selfBalance,
    args.opponentBalance,
    ACTION_CODE[args.action],
    args.amount,
    1n,
  ];
  return keccak256(
    concat(fields.map((v) => numberToHex(BigInt(v), { size: 32 })))
  );
}

export { idField, matchIdField };

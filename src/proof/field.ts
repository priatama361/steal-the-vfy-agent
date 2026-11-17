import { keccak256, toBytes } from "viem";

export const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function modP(value: bigint | string | number): bigint {
  const v = BigInt(value);
  return ((v % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
}

const HEX = /^0x[0-9a-fA-F]+$/;
const DEC = /^\d+$/;

/** hex / desimal -> integer; selain itu -> keccak256(utf8) mod p. */
export function idField(value: string): bigint {
  const s = String(value).trim();
  if (HEX.test(s)) return modP(BigInt(s));
  if (DEC.test(s)) return modP(BigInt(s));
  return modP(BigInt(keccak256(toBytes(s))));
}

/** UUID matchId: hilangkan tanda hubung lalu perlakukan sebagai hex. */
export function matchIdField(matchId: string): bigint {
  const compact = String(matchId).replace(/-/g, "");
  return /^[0-9a-fA-F]+$/.test(compact) ? modP(BigInt(`0x${compact}`)) : idField(matchId);
}

/** Salt boleh berupa angka/heks atau string bebas (di-hash ke field). */
export function saltField(salt: string): bigint {
  return idField(salt);
}

export function parseAmount(value: unknown): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) return BigInt(value.trim());
  throw new Error("nilai numerik tidak valid");
}

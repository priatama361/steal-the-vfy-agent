import { buildPoseidon } from "circomlibjs";
import { STRATEGY_PARAMS, STRATEGY_SALT } from "../config";
import { saltField } from "../proof/field";

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

/** commitment = Poseidon(strategyParams[0..7], salt) — circomlibjs / BN128. */
export async function computeCommitment(
  params: bigint[] = STRATEGY_PARAMS,
  salt: string = STRATEGY_SALT
): Promise<bigint> {
  if (!salt) throw new Error("STRATEGY_SALT belum diisi");
  if (params.length !== 8) throw new Error("STRATEGY_PARAMS harus 8 elemen");
  poseidonPromise ??= buildPoseidon();
  const poseidon = await poseidonPromise;
  return BigInt(poseidon.F.toString(poseidon([...params, saltField(salt)])));
}

export async function commitmentHex(
  params?: bigint[],
  salt?: string
): Promise<`0x${string}`> {
  const c = await computeCommitment(params, salt);
  return `0x${c.toString(16).padStart(64, "0")}`;
}

declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
      logger?: Record<string, (...args: unknown[]) => void>
    ): Promise<{ proof: Record<string, unknown>; publicSignals: string[] }>;
    verify(
      vkey: unknown,
      publicSignals: string[],
      proof: Record<string, unknown>,
      logger?: Record<string, (...args: unknown[]) => void>
    ): Promise<boolean>;
  };
}

declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    (inputs: unknown[]): unknown;
    F: {
      toString(value: unknown): string;
    };
  }>;
}

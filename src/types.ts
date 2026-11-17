export interface TurnEnvelope {
  protocolVersion?: string;
  eventId?: string;
  mode?: "competition" | "practice" | string;
  matchId: string;
  turn: number;
  issuedAt?: string;
  deadlineAt?: string;
  state: {
    selfBalance: string;
    opponentBalance: string;
    selfFortifiedUntilTurn?: number | null;
    opponentFortifiedUntilTurn?: number | null;
  };
  strategyCommitment?: { hash?: string };
  resolverVersion?: string;
  nonce?: string;
  type?: string;
}

export interface PreflightEnvelope {
  type: string;
  agent_id?: string;
  issued_at?: string;
  nonce?: string;
}

export type AgentAction =
  | { type: "HOLD" | "FORTIFY" }
  | { type: "EXTRACT"; amount: number };

export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
  [key: string]: unknown;
}

export interface TurnResponse {
  matchId: string;
  turn: number;
  action: AgentAction;
  policyProof: {
    circuitVersion: "v1";
    proof: Groth16Proof;
    public_signals: string[];
    publicInputsHash?: string;
    proofReference?: string;
  };
  agentTimestamp: string;
  idempotencyKey: string;
}

export interface CircuitInput {
  commitment: string;
  matchId: string;
  turnNumber: string;
  selfBalance: string;
  opponentBalance: string;
  action: string;
  amount: string;
  circuitVersion: string;
  salt: string;
  strategyParams: string[];
}

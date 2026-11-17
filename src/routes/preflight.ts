/** Preflight wajib sebelum task apa pun. Response harus di-sign. */
export function handlePreflight(): { ok: true; protocolVersion: "v1" } {
  return { ok: true, protocolVersion: "v1" };
}

export function isPreflight(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "agent-games.preflight.v1" || (v.type === undefined && v.nonce !== undefined && v.agent_id !== undefined);
}

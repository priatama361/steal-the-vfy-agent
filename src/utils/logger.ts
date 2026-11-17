/** Logger minimalis: tidak pernah mencetak secret, parameter strategi, atau salt. */
function safeMeta(meta?: Record<string, unknown>): string {
  if (!meta) return "";
  const blocked = /secret|salt|param|key|signature|token|api/i;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.test(k)) continue;
    clean[k] = v;
  }
  return Object.keys(clean).length ? " " + JSON.stringify(clean) : "";
}

export function log(event: string, meta?: Record<string, unknown>): void {
  const line = `[${new Date().toISOString()}] ${event}${safeMeta(meta)}`;
  if (event.startsWith("error") || event.startsWith("reject")) console.error(line);
  else console.log(line);
}

export const QUIET = Object.fromEntries(
  ["log", "info", "warn", "error", "debug"].map((k) => [k, () => {}])
);

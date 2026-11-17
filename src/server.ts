import express, { type Request, type Response } from "express";
import { HMAC_SECRET, MAX_BODY_BYTES, PORT } from "./config";
import { SIGNATURE_HEADER, sign, verify, type SignatureFormat } from "./hmac";
import { handlePreflight, isPreflight } from "./routes/preflight";
import { handleTurn, isTurnEnvelope } from "./routes/turn";
import { log } from "./utils/logger";

const app = express();
app.disable("x-powered-by");

// Raw body WAJIB tersedia sebelum JSON.parse untuk verifikasi HMAC.
app.use(express.raw({ type: () => true, limit: MAX_BODY_BYTES }));

const respCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function send(res: Response, status: number, body: unknown, fmt: SignatureFormat): void {
  const raw = Buffer.from(JSON.stringify(body));
  res.status(status);
  res.setHeader("content-type", "application/json");
  res.setHeader("content-length", raw.length);
  if (HMAC_SECRET) res.setHeader(SIGNATURE_HEADER, sign(HMAC_SECRET, raw, fmt));
  res.end(raw);
}

function idemKeyOf(message: Record<string, unknown>): string | null {
  if (isPreflight(message)) return null;
  if (message.matchId !== undefined && message.turn !== undefined) {
    return `turn:${message.mode || "competition"}:${message.matchId}:${message.turn}`;
  }
  return null;
}

async function dispatch(message: Record<string, unknown>): Promise<unknown> {
  if (isPreflight(message)) return handlePreflight();
  if (isTurnEnvelope(message)) return handleTurn(message);
  throw Object.assign(new Error("unknown task type"), { status: 400 });
}

app.get(["/health", "/agent", "/"], (_req, res) => {
  res.status(200).json({
    ok: true,
    protocolVersion: "v1",
    ready: !!HMAC_SECRET,
  });
});

app.post(["/agent", "/"], async (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

  if (!HMAC_SECRET) {
    log("reject", { why: "secret belum dikonfigurasi" });
    return send(res, 503, { error: "agent not configured" }, "hex");
  }

  const fmt = verify(HMAC_SECRET, raw, req.headers[SIGNATURE_HEADER] as string | undefined);
  if (!fmt) {
    log("reject", { why: "signature tidak valid" });
    return send(res, 401, { error: "invalid signature" }, "hex");
  }

  let message: Record<string, unknown>;
  try {
    message = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    return send(res, 400, { error: "invalid json" }, fmt);
  }

  try {
    const key = idemKeyOf(message);
    if (key) {
      const cached = respCache.get(key);
      if (cached) {
        log("idem-hit", { matchId: message.matchId, turn: message.turn });
        return send(res, 200, cached, fmt);
      }
      if (!inflight.has(key)) {
        inflight.set(
          key,
          dispatch(message)
            .then((out) => {
              respCache.set(key, out);
              return out;
            })
            .finally(() => inflight.delete(key))
        );
      }
      return send(res, 200, await inflight.get(key), fmt);
    }

    const out = await dispatch(message);
    log("preflight", { ok: true });
    return send(res, 200, out, fmt);
  } catch (err) {
    log("error", { message: (err as Error).message.slice(0, 160) });
    return send(res, (err as { status?: number }).status || 500, { error: "internal" }, fmt);
  }
});

app.use((_req, res) => res.status(404).json({ error: "not found" }));

app.listen(PORT, () => {
  log("listen", { port: PORT, ready: !!HMAC_SECRET });
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HMAC_SECRET, STRATEGY_SALT, isStrategyConfigured } from "../src/config";
import { SIGNATURE_HEADER, sign, verify } from "../src/hmac";
import { handlePreflight } from "../src/routes/preflight";
import { handleTurn } from "../src/routes/turn";
import { publicInputsHash } from "../src/proof/publicInputs";
import { matchIdField } from "../src/proof/field";
import { computeCommitment, commitmentHex } from "../src/strategy/commitment";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) =>
  fs.readFile(path.join(HERE, "fixtures", name), "utf8");

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  OK  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

const TEST_SECRET = "local-test-only-not-a-real-secret";
const raw = await read("preflight.json");

console.log("\n[1] HMAC");
const hexSig = sign(TEST_SECRET, Buffer.from(raw), "hex");
check("verify hex", verify(TEST_SECRET, Buffer.from(raw), hexSig) === "hex");
const shaSig = sign(TEST_SECRET, Buffer.from(raw), "sha256=");
check("verify sha256=", verify(TEST_SECRET, Buffer.from(raw), shaSig) === "sha256=");
const b64Sig = sign(TEST_SECRET, Buffer.from(raw), "base64");
check("verify base64", verify(TEST_SECRET, Buffer.from(raw), b64Sig) === "base64");
check("salah secret ditolak", verify("salah", Buffer.from(raw), hexSig) === null);
check("body diubah ditolak", verify(TEST_SECRET, Buffer.from(raw + " "), hexSig) === null);

console.log("\n[2] Preflight");
const preflight = handlePreflight();
check("response preflight", preflight.ok === true && preflight.protocolVersion === "v1");

console.log("\n[3] publicInputsHash & matchId");
const turnRaw = await read("turn.json");
const turn = JSON.parse(turnRaw) as Parameters<typeof handleTurn>[0];
const h1 = publicInputsHash({
  commitment: 1n,
  matchId: turn.matchId,
  turn: turn.turn,
  selfBalance: 95n,
  opponentBalance: 105n,
  action: "EXTRACT",
  amount: 5n,
});
const h2 = publicInputsHash({
  commitment: 1n,
  matchId: turn.matchId,
  turn: turn.turn,
  selfBalance: 95n,
  opponentBalance: 105n,
  action: "EXTRACT",
  amount: 5n,
});
check("hash deterministik", h1 === h2);
check("hash 32 byte", /^0x[0-9a-f]{64}$/.test(h1));
check("matchId field dari UUID", /^\d+$/.test(matchIdField(turn.matchId).toString()));

console.log("\n[4] Commitment + proof (hanya jika strategi & salt terisi)");
if (isStrategyConfigured() && STRATEGY_SALT) {
  check("commitment hex valid", /^0x[0-9a-f]{64}$/.test(await commitmentHex()));
  check("commitment deterministik", (await computeCommitment()) === (await computeCommitment()));

  // Pakai commitment lokal pada fixture agar sirkuit menerima public input.
  const local = await commitmentHex();
  turn.strategyCommitment = { hash: local };
  const res = await handleTurn(turn);
  check("action ada", !!res.action && !!res.action.type);
  check("policyProof.proof ada", !!res.policyProof.proof);
  check("public_signals ada", Array.isArray(res.policyProof.public_signals));
  check("jumlah public_signals = 9", res.policyProof.public_signals?.length === 9);
  check("amount HOLD/FORTIFY dihilangkan", res.action.type === "EXTRACT" ? typeof res.action.amount === "number" : !("amount" in res.action));
  check("idempotencyKeyTerisi", !!res.idempotencyKey);
} else {
  console.log("  SKIP — isi STRATEGY_PARAMS dan STRATEGY_SALT di .env untuk menguji proof.");
}

console.log(`\nHasil: ${passed} lulus, ${failed} gagal\n`);
// snarkjs mempertahankan worker pool; hentikan eksplisit agar harness selesai.
process.exit(failed > 0 ? 1 : 0);

void HMAC_SECRET;
void SIGNATURE_HEADER;

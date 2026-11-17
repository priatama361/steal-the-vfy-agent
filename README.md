# Steal the VFY — Agent Harness (TypeScript / Node.js)

Agent untuk **zkVerify Agent Games — Steal the VFY**. Endpoint menerima turn envelope
yang di-sign, menghasilkan aksi deterministik sesuai parameter strategi yang Anda
commit, membuat Groth16 proof secara lokal dengan `snarkjs`, dan mengembalikan
response yang di-sign.

> **Strategi adalah milik Anda.** Repo ini sengaja **tidak** berisi nilai strategi.
> `STRATEGY_PARAMS` dan `STRATEGY_SALT` harus Anda isi sendiri. Plumbing boleh
> di-vibecode; strategi tidak.

## Arsitektur

```
Platform POST /agent (signed, raw body)
  ├─ verifikasi HMAC-SHA256 atas RAW body (sebelum JSON.parse)
  ├─ preflight  -> { ok: true, protocolVersion: "v1" } (signed)
  └─ turn
       ├─ policy(state, STRATEGY_PARAMS)      [aturan yang di-enforce sirkuit]
       ├─ commitment = Poseidon(params, salt) [rahasia]
       ├─ snarkjs.groth16.fullProve(wasm, zkey) + verify lokal
       ├─ publicInputsHash = keccak256(8 field × 32-byte)
       ├─ Kurier zkVerify (OPSIONAL, fire-and-forget)
       └─ response signed + idempotency key per turn
```

## Setup

```bash
npm install
cp .env.example .env
```

Isi `.env`:

| Variable | Wajib | Keterangan |
|---|---|---|
| `AGENT_GAMES_HMAC_SECRET` | ya | Secret dari Dashboard → Rotate Secret (tampil sekali) |
| `STRATEGY_SALT` | ya | Salt rahasia untuk commitment Poseidon |
| `STRATEGY_PARAMS` | ya | 8 parameter strategi Anda (JSON array), lihat below |
| `PORT` | tidak | Default `8787` |
| `ZKVERIFY_SUBMIT` | tidak | Default `false`. Audit pointer saja, tidak mem-blok response |
| `KURIER_API_KEY` | tidak | Diperlukan hanya jika `ZKVERIFY_SUBMIT=true` |

Format `STRATEGY_PARAMS` (8 elemen, sesuai sirkuit resmi):

```
[ extractAmount(1..10), fortifyIfSelfBelow, holdIfOppAtMost, alwaysHold(0/1), 0, 0, 0, 0 ]
```

Aturan yang di-enforce sirkuit:

1. `selfBalance < p[1]` → `FORTIFY`
2. `opponentBalance <= p[2]` atau `p[3] === 1` → `HOLD`
3. selainnya → `EXTRACT` sebesar `p[0]`

Elemen `p[4..7]` wajib `0`.

Sebelum Swiss Round 1, daftarkan commitment di
**Dashboard → My Agents → Edit agent → Steal the VFY**:

```bash
npm run commitment
```

Perintah ini mencetak **hanya** commitment publik — tidak mencetak salt/parameter.

## Jalankan

```bash
npm run dev      # development (tsx watch)
npm start        # production
npm test         # harness lokal
npm run typecheck
```

Karena platform hanya menerima HTTPS publik, untuk development Anda bisa
mengekspos lewat tunnel HTTPS (mis. `cloudflared tunnel --url http://localhost:8787`)
lalu mendaftarkan URL penuh `/agent` (bukan root saja).

## Endpoint

- `POST /agent` — preflight + turn (signed)
- `GET /health` — health check

Semua response membawa header `x-agent-games-signature` (HMAC-SHA256 atas raw
response body). Format signature mengikuti format yang dipakai platform
`hex` (default), `sha256=<hex>`, atau `base64`.

## Response turn

```json
{
  "matchId": "...",
  "turn": 3,
  "action": { "type": "EXTRACT", "amount": 5 },
  "policyProof": {
    "circuitVersion": "v1",
    "proof": { "pi_a": [], "pi_b": [], "pi_c": [], "protocol": "groth16", "curve": "bn128" },
    "public_signals": ["..."],
    "publicInputsHash": "0x..."
  },
  "agentTimestamp": "2026-11-17T00:00:00.000Z",
  "idempotencyKey": "..."
}
```

`proof` dan `public_signals` **wajib di dalam** `policyProof`. Field `amount`
**dihilangkan** untuk `HOLD`/`FORTIFY`.

## Fail-closed

Jika parameter/salt belum diisi, proof gagal, atau terjadi error/timeout, agent
mengembalikan `HOLD` tanpa proof dan mencatat alasannya (tanpa secret).
Ini mencegah aksi invalid, meski tetap dikenakan penalti proof tidak valid.

## Keamanan

- `.env` dan `secrets.env` masuk `.gitignore`.
- Tidak ada secret, salt, atau parameter yang dicetak ke log/console.
- Semua secret dibaca dari environment variable.
- Verifikasi HMAC terjadi sebelum parsing JSON.
- Proof diverifikasi lokal terhadap VK resmi sebelum dikirim.

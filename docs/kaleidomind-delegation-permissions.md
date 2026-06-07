# KaleidoMind — Delegation Permission Model (design)

> Status: **design / proposal**. Not yet implemented. Owner: TBD.

## Context

The desktop is the QVAC **provider** ("the brain"): it hosts a local model and a
phone pairs to it (via the pairing QR — the provider's public key) to delegate
inference. Separately, KaleidoMind's chat can **act on the node** through the
connected MCP tools (`rln_*` / `kaleidoswap_*`), i.e. it can move money: pay
invoices, send BTC/assets, open/close channels.

The risk: once a phone is paired, "delegate inference" must **not** silently
become "let a remote device spend my funds." We need an explicit trust boundary
between *thinking* (inference) and *acting* (node-affecting tool calls).

## Principles

1. **Inference ≠ authority.** Pairing grants the phone the right to run prompts
   on the desktop model. It grants **no** node/wallet authority by default.
2. **Money actions are always gated**, regardless of who initiated the prompt
   (local user or paired phone). Read-only tools (balances, lists, invoices to
   receive) are lower-risk; value-moving tools are high-risk.
3. **Per-session, per-action consent** — never a standing "allow all."
4. **The desktop owner is the root of trust.** Approvals happen on the desktop
   (the device that holds the keys), not on the paired phone.

## Tool risk tiers

| Tier | Examples | Default policy |
|------|----------|----------------|
| **Read** | `rln_get_balances`, `rln_list_channels`, `rln_list_payments`, `get_price` | Allowed (still scoped to the local node) |
| **Receive** | `rln_create_ln_invoice`, `rln_get_address` | Allowed; surfaced in activity log |
| **Spend** | `rln_pay_invoice`, `rln_send_btc`, `rln_send_asset`, `rln_mpp_pay` | **Confirm on desktop** every time |
| **Structural** | `rln_open_channel`, `rln_close_channel`, atomic swaps | **Confirm on desktop** + amount/peer shown |
| **Prohibited over delegation** | key export, mnemonic, node config changes | Never available to a paired phone |

## Proposed model

- **Two scopes per paired peer:** `inference` (always, implied by pairing) and
  `node` (off by default). A phone only reaches node tools if the owner enables
  the `node` scope for that specific peer.
- **Even with `node` scope**, Spend/Structural calls raise a **confirmation
  prompt on the desktop** showing: initiating peer, tool, full args (amount,
  destination, asset), and a fee/impact summary. Nothing executes without an
  explicit desktop approval.
- **Spend limits (optional):** per-peer daily cap + per-tx cap; within the cap,
  the owner may opt into "auto-approve receive + small spend." Above the cap,
  always prompt.
- **Kill switch + audit:** an always-visible "paired devices" panel (Pairing
  tab) listing connected peers, their scope, a live action log, and one-tap
  revoke. Revoke drops the peer immediately.
- **Local user prompts** that trigger Spend/Structural tools get the same
  desktop confirmation — consistency means the agent can never move funds on a
  bare natural-language instruction without a typed/clicked confirm.

## Required building blocks (not present today)

- **Sidecar / provider:** tag each incoming chat request with its origin
  (`local` vs `peer:<pubkey>`), and emit a **tool-call intent event** *before*
  executing any node tool, so the desktop can interpose a confirmation. Today
  `chat` returns only the final text (see `src/api/mind.ts` — commands are
  `chat`, `get_status`, model + download ops; no tool-authorization hook).
- **Desktop:** a confirmation modal + a paired-devices/scope manager UI
  (Pairing tab) + persisted per-peer scope/limits.
- **MCP layer:** classify each tool into the tiers above (allowlist by name).

## Open questions

- Where does confirmation live when the desktop is headless / backgrounded?
  (Push to a trusted channel? Queue and require desktop foreground?)
- Do we ever allow a phone to *receive* (create invoices/addresses) without the
  `node` scope, since that's low-risk and a common use case?
- Multi-account: is delegation scoped to the **current** node account only?
  (Recommended: yes — never cross-account.)

## Related

- Skills tab currently can't enumerate the agent's real tools — the sidecar
  protocol has no `list_tools`/`list_skills` command. Wiring the Skills tab to
  live data and classifying tools into the tiers above should land together,
  since both need the provider to expose its tool registry.

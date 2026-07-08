# Security & Logic Analysis — Telecaller ⇄ Ads Stage Machine

**Type:** Analysis report. **Status:** all §5 recommendations were implemented on 2026-07-08.
**Scope:** How a deal moves through its automatic stages, how money is attributed, and what a telecaller (or admin) can do to cheat the numbers or trip logic errors.
**Date:** 2026-07-08

---

## 1. Context

The CRM models every enquiry/deal as an `Ad`. Each Ad carries two independent state fields:

- **`status`** — the pipeline stage (the "linear path"), forward-only for telecallers.
- **`phase`** — an auto-derived tier of how many times the client has paid (`CLOSED` → `RENEWAL` → `REGULAR`).

Revenue, incentives, and target bonuses are all computed off PAID Ads. This report maps the real path and then enumerates where the path can be gamed or produces wrong data. It is a diagnosis only; remediation is intentionally left out.

---

## 2. The linear path (as built)

### 2.1 Status stage-machine
Defined in `src/lib/utils.ts:93` (`ALLOWED_TRANSITIONS`):

```
NOT_CLOSED → FOLLOW_UP | PENDING | PAID | IRRELEVANT
FOLLOW_UP  → PENDING | PAID
PENDING    → PAID
PAID       → (none — renew only)
IRRELEVANT → (terminal)
```

- **Enforcement:** `isTransitionAllowed(from, to, isAdmin)` (`utils.ts:112`) — called **only on `PUT /api/ads/[id]`** (`[id]/route.ts:55`).
- **Admin:** returns `true` unconditionally → admins can move a deal to *any* status, including backward (e.g. PAID → PENDING).
- **Create path is unguarded:** `POST /api/ads` accepts `status` directly (`route.ts:127`) with no transition check — a deal can be created at *any* status, including PAID or IRRELEVANT. (Legitimate for walk-in conversions, but means "forward-only" is an edit-time rule only.)

### 2.2 Phase machine (auto, on PAID)
`phaseForSeq(seq)` (duplicated in `route.ts:8` and `[id]/route.ts:8`):

```
seq 1 → CLOSED     seq 2 → RENEWAL     seq 3+ → REGULAR
```
`seq` = count of that client's PAID Ads. Assigned when a deal becomes PAID; cleared to `null` when an admin reverts a deal off PAID (`[id]/route.ts:98`).

### 2.3 Money attribution model
| Metric | Route | Status guard | Attributed by | Bucketed by |
|---|---|---|---|---|
| Revenue | `api/revenue/route.ts:21` | `status=PAID` ✓ | `assignedToId` | `closeDate` |
| Incentive | `api/incentive/route.ts:24` | `status=PAID` ✓ | `assignedToId` | `closeDate` |
| Target converts | `api/targets/route.ts` | `status=PAID` ✓ | `assignedToId` | `closeDate` |
| Target leads | `api/targets/route.ts` | any status | `assignedToId` | `closeDate` |

Key consequence: **the money follows `assignedToId`, and the month follows the editable `closeDate`.** Both are attacker-controllable (see §3).

---

## 3. Findings — cheat vectors & logic errors

### 🔴 Critical — broken access control (telecaller, via raw API; the UI hides these but the server does not enforce)

| # | Issue | Location | Exploit / impact |
|---|---|---|---|
| C1 | **Edit ANY deal** — no ownership check on PUT | `src/app/api/ads/[id]/route.ts:39-128` (missing gate ~line 51) | GET list is scoped to owner, but PUT is not re-scoped. A telecaller edits deals they don't own by id. |
| C2 | **Steal deals + revenue credit** — `assignedToId` settable on PUT, no role gate | `[id]/route.ts:69` | Reassign any PAID deal to self; since revenue/incentive key on `assignedToId`, this transfers the money. POST correctly forces self-assign (`route.ts:172`) — PUT does not. |
| C3 | **Read ANY deal + full timeline** — GET single is unscoped | `[id]/route.ts:15-35` | Enumerate deal ids → client PII, amounts, assignee, stage history. |
| C4 | **Renewal fraud** — `renewedAt` / `supersededById` freely settable | `[id]/route.ts:72-73` | Mark deals renewed (removes from waiting queue) or chain arbitrary deal ids. |
| C5 | **Export entire client DB** — `type=clients` export has no owner scope | `src/app/api/reports/export/route.ts:92-97` | `GET /api/reports/export?type=clients` returns ALL clients' name/phone/email/city/revenue. (deals/payments/targets exports ARE scoped at line 52.) |
| C6 | **Enumerate all users** — GET single user unscoped | `src/app/api/users/[id]/route.ts` | Any authenticated user reads any user's name/email/phone/role. |
| C7 | **Enumerate clients** — lookup unscoped | `src/app/api/clients/lookup/route.ts` | Phone substring lookup returns client existence + paid-deal counts for any client (used for form autofill, but not owner-scoped). |

### 🟡 High/Medium — metric gaming (also available to a deal's legitimate owner)

| # | Issue | Location | Exploit / impact |
|---|---|---|---|
| M1 | **Backdate `closeDate`** into a chosen month | `[id]/route.ts:70`, create `route.ts:128` | Shift a PAID deal's revenue/incentive/target credit into any month; no edit window. |
| M2 | **Edit `amount` after PAID** | `[id]/route.ts:64` | Inflate/deflate booked revenue and incentive at will. |
| M3 | **No audit of non-status edits** | `DealStageEvent` only logs status changes (`[id]/route.ts:114`) | amount, closeDate, and assignment changes leave no trail. |
| M4 | **Unbounded / negative `amount`** | create `route.ts:159`, edit `[id]/route.ts:64` | `parseFloat` with no min/max; negative or absurd values accepted. |
| M5 | **Admin can reverse PAID backward** | `utils.ts:107,113` (override) | Reproduces the observed "Conversion/Paid → Waiting for Payment" case; drops a converted deal back into the follow-up queue. |
| M6 | **`achievedBonus` never reconciled** | `Target.achievedBonus` written once; recomputed only client-side (`admin/targets/page.tsx:135`) | No server record of which bonuses were actually earned/paid; relies on live recount that itself depends on M1/M2. |

### 🟢 Low — logic bugs

| # | Issue | Location | Effect |
|---|---|---|---|
| L1 | **Phase/seq race on edit→PAID** | `[id]/route.ts:92` computes `paidCount` with `prisma` **before/outside** the `$transaction` at line 105 (POST does it inside `tx` at `route.ts:151`) | Two concurrent PUT→PAID for the same client can receive the same `seq`/`phase`. |
| L2 | **Stale fields after revert** | `[id]/route.ts:98-102` clears phase/seq but not `amount`/`endDate`/`renewedAt` | A reverted-to-PENDING deal keeps its old paid-term end date (odd countdown in Follow-ups). |
| L3 | **`phaseForSeq` duplicated** | `route.ts:8` and `[id]/route.ts:8` | Two copies of the tier rule can drift; belongs in `utils.ts`. |

---

## 4. What is already safe (for completeness)

- Every money aggregation (`revenue`, `incentive`, `targets`, `reports` deals/payments) correctly filters `status=PAID`; no unguarded `_sum: amount` exists.
- `POST /api/ads` forces `assignedToId = self` for telecallers (`route.ts:172`).
- `DELETE /api/ads/[id]` is admin-only (`[id]/route.ts:136`).
- `GET /api/ads` list is owner-scoped (`route.ts:45`).
- User create/update/delete, target create, announcement create/delete, settings write are all admin-gated.
- Middleware (`src/middleware.ts`) redirects telecaller↔admin URL prefixes (URL-level only — not a substitute for API scoping).
- POST create phase/seq assignment IS transaction-safe (`route.ts:147-154`).

---

## 5. Recommendations (high-level — not a build plan)

Priority order if/when this is acted on:

1. **Add an ownership guard** to `GET`/`PUT /api/ads/[id]` (telecaller must own via `assignedToId`/`createdById`) — closes C1, C3, and blunts C2/C4.
2. **Role-gate mutable fields on PUT**: `assignedToId`, `renewedAt`, `supersededById`, and ideally `closeDate`/`amount` should be admin-only or owner-restricted — closes C2, C4, M1, M2.
3. **Scope the `type=clients` export** and `GET /api/users/[id]` / `clients/lookup` to the requester — closes C5, C6, C7.
4. **Bound `amount`** (reject negative / absurd) and validate dates — closes M4.
5. **Freeze `amount` (and lock `closeDate`) once PAID**, admin-override + audit — addresses M2/M1.
6. **Audit non-status edits** (extend `DealStageEvent` or a new log for amount/date/assignment) — closes M3, supports M6.
7. **Make PAID final** (block backward transitions even for admin; renew is the only forward move) — closes M5.
8. **Move `paidCount` inside the `$transaction` on PUT** and dedupe `phaseForSeq` into `utils.ts` — closes L1, L3.

---

## 6. Verification (how to reproduce the key findings)

- **C1/C2 (IDOR + steal):** As telecaller A, `PUT /api/ads/{a-deal-owned-by-B}` with `{ "assignedToId": "<A-id>" }` → succeeds; `GET /api/revenue` for A now includes B's deal amount.
- **C5 (client export):** As any telecaller, `GET /api/reports/export?type=clients` → Excel contains every client.
- **M1 (month shift):** `PUT` a PAID deal with `{ "closeDate": "<first of another month>" }`; re-query `/api/incentive?month=…` → the deal moves months.
- **M5 (paid reversal):** As admin, edit a PAID deal's status to Waiting for Payment → it appears under Follow-ups ▸ Waiting.
- **L1 (seq race):** Fire two concurrent `PUT status=PAID` for two different NOT_CLOSED deals of the same client → both may get identical `seq`/`phase`.

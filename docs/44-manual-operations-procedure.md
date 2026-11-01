# 44 — Manual Operating Procedure (C2) & Staff Access (C3)

**Status:** Active procedure for the controlled pilot, effective 2026-11-01. **Needs owner approval** of response windows and channels before the first real customer.

Until notifications, a payment gateway and portal delivery exist, the admin runs these steps by hand. Customer-facing copy already says that processing is manual (success screen, Privacy, Terms).

| Step | Who | Action | Record in portal |
|---|---|---|---|
| 1. New brief | Admin | Check the inbox at least once per business day (proposed). Reply on the customer's chosen channel, using the reference number. | Status → Kualifikasi; internal note: "acknowledged via <channel> <date>" |
| 2. Quote | Admin | Create the quote (deliverables, revisions, ETA, usage terms) → Kirim. Issue a customer link. Send the link privately to the customer. | Quote sent; status → Penawaran dikirim; `access_link_issued` event |
| 3. Quote decision | Customer | Accepts or rejects in the portal. | `quote_accepted` / `quote_rejected` (by customer) |
| 4. Payment | Admin | Check the bank mutation or statement yourself. **Never** mark payment from a screenshot alone, or before the funds are visible. | "Catat konfirmasi manual" with amount, method, transaction ref |
| 5. Production | Admin | Queue → Produce → Internal QA (docs/34). Log actual time and tool costs. | Status changes; cost ledger |
| 6. Review | Admin | Send previews through a private channel (docs/41 interim). Customer sends consolidated feedback in the portal. | `customer_review`; feedback rows (within/out of scope) |
| 7. Delivery & approval | Admin + customer | Interim: private share + written approval recorded as an internal note (docs/41). Portal approval unlocks once R2 is enabled. | Internal note with filenames + checksum + approval date |
| 8. Close | Admin | Revoke share links after the agreed period. Export the project JSON for records. | `project_exported` event |

## Escalation & support
- Complaints and data requests arrive via the Contact page or the reply channel. Log each as an internal note with the date. Proposed target: acknowledge within 2 business days.
- Security events: docs/43.

## Staff access (C3)
- **Single-admin mode is the deliberate pilot design.** Only the account configured via Cloudflare secrets can sign in. The `producer` role exists in the schema but is **not functional**: the server rejects any non-admin session, and an automated test covers this.
- Before adding staff, build: per-user accounts, an invitation flow, a role matrix, disable/revoke, per-user audit attribution and role-boundary tests. Do not share the admin password.

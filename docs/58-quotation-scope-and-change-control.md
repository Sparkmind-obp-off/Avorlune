# 58 — Quotation, Scope and Change Control

**Status:** Commercial and operational specification.

## Purpose

The quotation converts a broad customer brief into an explicit, versioned agreement.

## Required fields

- Unique quotation reference and version.
- Customer/project reference.
- Service and scope summary.
- Deliverables: quantity, dimensions/duration, formats, channels.
- Included concepts/variants and revision rounds.
- Exclusions and customer dependencies.
- Production schedule and estimated delivery date.
- Total price, currency, tax/payment-fee treatment.
- Payment schedule: default 50% deposit / 50% balance.
- Expiry.
- Cancellation/refund policy reference.
- Usage/license terms and AI-assisted production disclosure.
- Acceptance timestamp and accepted version.

## Lifecycle

Draft → sent → viewed → accepted, declined, expired, or superseded.

Only the latest valid version may be accepted. Editing after acceptance requires a new version and renewed customer acceptance.

## Scope freeze

On acceptance, persist an immutable scope snapshot. Payment amounts and production tasks derive from that snapshot, not mutable client values or a subsequently edited catalog.

## Change requests

A change request is required for additional deliverables/variants, new concept after approval, materially changed source materials, new formats/channels, extra revisions, or accelerated deadline.

Admin assesses cost, schedule, feasibility, and rights. Issue a versioned change quotation when price or delivery changes. Do not start changed work before acceptance and required payment.

Minor corrections within the agreed scope remain within included revision terms.

## Capacity and expiry

Before quoting, verify provider capability/terms, credit availability, staff capacity, rights, deadline, storage/delivery, and contribution margin. A quote expires at its stated time. Material cost/capacity changes require a revised quote, never a silent price change.

## Customer presentation

Clearly show what is received, included, excluded, timeline, revisions, payment schedule, usage rights/limitations, and actions to accept or ask a question. No hidden fees or preselected consent.

## Audit and acceptance

Only authorized admin roles create/send/supersede quotes. Record actor, timestamp, version, amount, scope hash, and customer acceptance. Sensitive actions require step-up authentication and CSRF controls.

Acceptance criteria: immutable accepted quote; server-derived payment schedule; expiry enforcement; no client amount control; change requests create new scope versions.

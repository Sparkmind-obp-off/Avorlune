# 88 — Production Operations and Quality Standard

**Status:** Operating specification.

## 1. Service readiness

A catalog item may be published only when it has:
- tested provider path or explicitly documented operator workflow;
- rights and terms review;
- validated input/output constraints;
- tested sample output that is honestly labeled;
- price/cost and capacity model;
- QA checklist;
- failure, retry and refund procedure;
- delivery and support path.

## 2. Quality dimensions

### Video
- brief and script alignment;
- product/brand identity fidelity;
- scene continuity and visual coherence;
- readable text and subtitles;
- audio/voice quality and synchronization;
- correct duration, aspect ratio and resolution;
- no unintended watermark or provider branding unless disclosed;
- correct CTA and no unsupported product claims.

### Image
- product shape/label/logo fidelity;
- realistic proportions and anatomy where relevant;
- artifact and text inspection;
- correct background, style and composition;
- dimensions, format and resolution;
- no misleading claims or unauthorized likeness.

### Content pack
- consistency across assets;
- coherent campaign message;
- correct channel-specific formats;
- no contradictory product details;
- complete manifest and captions where included.

## 3. QA model

Use automated validation for technical constraints and human review for risk/quality tiers. Define pass, regenerate, revise, block and escalate outcomes. Record reviewer, checks, timestamp and asset version. A failed internal generation is not charged as a customer revision.

## 4. Rights, privacy and safety

- Customer confirms rights to uploaded source material.
- Maintain provenance for generated and third-party assets.
- Check provider commercial-use terms for the selected plan and capability.
- Do not generate deceptive endorsements, unauthorized likenesses or prohibited content.
- Regulated claims (health, finance, legal, supplements, etc.) require evidence and additional review or refusal.
- Do not use customer assets for training or portfolio without explicit permission.
- Define retention and deletion periods.
- Keep customer uploads and deliverables private.

## 5. Operational controls

- provider-level spend caps and pause switch;
- daily/monthly budget alert;
- order capacity limit;
- retry ceiling and timeout;
- incident and escalation queue;
- customer notification for material delays;
- refund/cancellation workflow;
- backup and restore test;
- provider outage fallback that does not silently substitute a materially different output.

## 6. Status transparency

Show meaningful customer-safe statuses. Do not show a job as "Generating" unless a job was actually submitted or an operator has started the approved workflow. Show delay/needs-input states rather than inventing progress.

## 7. Launch monitoring

Track order volume, provider spend, generation failure, cost per accepted output, time in each stage, first-pass approval, revisions, refund rate, on-time delivery and support load. Review daily during pilot and weekly after stabilization.

## 8. Incident handling

For provider outage, suspected secret exposure, private asset leak, payment mismatch, unauthorized access or harmful output:
1. pause affected provider/service;
2. protect customer data and stop release;
3. preserve minimal audit evidence;
4. notify owner and affected customers as required;
5. rotate secrets or revoke access where relevant;
6. reconcile affected orders/payments;
7. document root cause and corrective action;
8. resume only after verification.

## 9. Customer promise

AVORLUNE promises the defined deliverables, scope, process and support stated in the offer. It does not promise virality, engagement, revenue, conversion or perfect AI output.

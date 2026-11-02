# 57 — Service Catalog and Brief Builder

**Status:** Product and UX specification.

## Catalog

Initial curated categories:
- AI Image Production.
- AI Video Production.
- Product and Advertising Creative.
- Social Media Content Packs.
- Campaign and Brand Visuals.
- Custom Creative Project.

Do not publish a service or price until delivery capability, licensing, sample rights, unit economics, and capacity are checked.

## Service detail page

Each service describes purpose, audience, rights-cleared examples, included outputs/formats, required customer inputs, options/add-ons, revision allowance, estimated turnaround, price or quotation mode, AI-assisted production disclosure, and licensing summary.

Use Request a quotation when price is not yet validated. Never invent fixed prices.

## Guided brief builder

Use a multi-step responsive form with progress, save draft, back/continue, conditional fields, validation, and final review. Avoid a single overwhelming form.

### Step 1 — Need
Service type, intended outcome, business goal, target audience.

### Step 2 — Deliverables
For images: quantity, dimensions/aspect ratio, resolution/format, variants, channels.  
For video: quantity, duration, aspect ratio, language, captions, audio/music needs, channels.  
For campaign: asset mix, channels, campaign period, consistency requirements.

### Step 3 — Creative direction
Style, mood, references, brand guidelines, colors, copy, product details, required and prohibited elements.

### Step 4 — Source material
Upload or link authorized logos, product photos, footage, brand guides, and references. Require rights confirmation.

### Step 5 — Timing and budget
Preferred deadline, flexibility, urgency, optional budget range. Do not promise capacity until reviewed.

### Step 6 — Contact and review
Contact, project name, usage context, consent, summary, submit.

## Structured data

Capture service/category/version, project goal, audience, deliverable specifications, creative direction, reference/source asset IDs, usage channels/territory, deadline, optional budget, contact, rights confirmation, consent version, and timestamps. Preserve the original submitted snapshot.

## Privacy and validation

Server-side validation is authoritative. Apply file signature and size checks, rate limits, honeypot, idempotency, and access controls. Never expose object keys or project tokens. Collect only necessary data and follow retention/deletion policy.

## Admin review

Show original brief/version, requested deliverables, source assets and rights declaration, deadline/budget, missing-information checklist, risk flags, clarification thread, and internal feasibility/capacity notes. Internal notes are never customer-visible by default.

## Acceptance criteria

- Service or custom project selection works.
- Fields adapt to service type.
- Server validates required data.
- Customer reviews before submission.
- Duplicate submission is idempotent.
- Submission creates an inquiry, not invoice or production job.
- Admin can clarify, qualify, decline, or quote.
- Brief versions and decisions are auditable.

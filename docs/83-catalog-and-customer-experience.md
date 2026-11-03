# 83 — Catalog and Customer Experience Specification

**Status:** Product and UX specification.

## 1. Storefront information architecture

Primary navigation:
- Explore
- Video
- Images
- Content Packs
- How it Works
- My Orders / Account

Catalog filters:
- asset type;
- use case (product ad, social content, explainer, brand visual);
- platform/format;
- duration or quantity;
- price mode (fixed / quote);
- estimated turnaround, only when validated.

Avoid a directory of AI providers. Customers browse outcomes, not model names.

## 2. Listing card

Every listing card shows:
- service title and outcome;
- representative sample marked as sample/demo where applicable;
- short use case;
- starting price or "Request quote";
- expected deliverable count/type;
- indicative turnaround only if measured;
- primary CTA: View details / Configure.

Never use synthetic demo work as a real customer portfolio or testimonial.

## 3. Service detail

Required sections:
- What this creates;
- examples and limitations;
- included outputs;
- output specs (resolution, aspect ratio, duration, file type);
- required customer inputs;
- available options/add-ons;
- included generation/revision allowance;
- excluded work;
- usage/license terms;
- price and payment milestones;
- turnaround estimate and queue caveat;
- AI-assisted production disclosure;
- FAQ and support path.

## 4. Order configuration

Use a short, adaptive flow rather than a large generic brief form.

### Shared fields
- purpose and intended channel;
- target audience;
- brand/product name and description;
- tone/style/reference;
- required and prohibited elements;
- deadline preference;
- authorized source files and rights confirmation.

### Video-specific fields
- duration band;
- aspect ratio;
- language;
- script supplied vs create script;
- voice-over/subtitle/audio preference;
- scene or product requirements;
- CTA and destination.

### Image-specific fields
- quantity;
- dimensions/aspect ratio;
- product fidelity requirements;
- background/style;
- text inclusion;
- variants and channel formats.

### Content pack fields
- asset mix;
- campaign theme;
- channel list;
- consistency/brand rules;
- publishing schedule preference (planning only; no automatic posting by default).

## 5. Preview before order

Before payment, show a durable order summary:
- selected offer and version;
- configuration and customer brief;
- exact deliverables;
- included generation/revision allowance;
- exclusions;
- price, tax/fees if applicable;
- deposit/balance schedule;
- estimated delivery window;
- rights and cancellation terms.

The customer explicitly confirms the summary. Changes after acceptance create a versioned scope change and may require a new quote.

## 6. Customer order workspace

Order status:
Draft → Awaiting payment → Queued → Generating → Quality review → Customer review → Revision (if included) → Ready for final payment → Delivered → Closed.

Expose only customer-safe status and notes. Internal provider names, prompts, raw logs, credentials, cost breakdowns and moderation notes remain private.

Customer workspace includes:
- order summary and receipt;
- milestone payments;
- progress timeline;
- clarification requests;
- preview gallery with watermark/limited access where appropriate;
- feedback and revision request;
- final asset download;
- support and reorder.

## 7. Revisions and regeneration

Distinguish:
- **Regeneration:** AVORLUNE reruns a generation because output failed internal QA or did not meet the accepted brief. This is operational correction and should not consume a customer revision allowance.
- **Included revision:** customer requests a change within the accepted scope and allowance.
- **Scope change:** customer changes product, script, audience, style direction, quantity or specification beyond the agreed scope; re-quote or paid add-on may apply.

Explain these distinctions before checkout.

## 8. Accessibility and trust

Mobile-first, clear progress, keyboard access, readable contrast, reduced motion, explicit upload rights confirmation, accessible error messages, no dark patterns. Show real availability only when backed by queue data.

## 9. Acceptance criteria

- Customers can browse without login.
- Customers can compare and configure a listing.
- Order summary reflects the exact offer version and configuration.
- Sign-in is required before private order submission/payment.
- A saved draft survives sign-in.
- Customer cannot view another customer's order or assets.
- Demo data is visibly synthetic and isolated from production.
- Provider technical details and secrets never appear in public responses.

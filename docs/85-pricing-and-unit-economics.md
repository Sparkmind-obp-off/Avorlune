# 85 — Pricing and Unit Economics

**Status:** Pricing framework. No public fixed prices are approved by this document.

## 1. Position

AVORLUNE aims to offer accessible, competitive pricing versus comparable freelancer production for standardized AI-suitable work. The platform should pass some automation savings to customers while maintaining quality, support, provider costs and positive contribution margin.

Do not promise a fixed percentage cheaper or claim that every service is cheaper than every freelancer.

## 2. Cost per accepted deliverable

Measure the full cost of a completed order, not just the initial generation call.

Direct cost components:
- provider generation usage, including failed generations;
- image/video processing, voice, music or upscaling;
- storage, egress and delivery;
- human QA and exception handling;
- customer support and revision handling;
- licensed stock/assets where applicable;
- payment processing and refunds;
- other order-specific costs.

Formula:

`Cost per accepted order = provider usage + processing + human operations + licensed assets + delivery + payment fees + other direct costs`

`Contribution = net order revenue - direct order costs`

Track average and percentile costs because video generation can vary substantially.

## 3. Offer pricing modes

- **Fixed:** exact scope and unit economics are validated.
- **Tiered:** clearly differentiated output quantity/complexity.
- **Add-on:** extra duration, variants, language, resolution, rush handling or additional revision.
- **Quote-required:** custom/uncertain work.
- **Unavailable:** capability, rights or economics are not ready.

Avoid "starting from" unless the minimum scope and all conditions are explicit.

## 4. Package dimensions

Price based on customer outcome and scope:
- number of accepted assets;
- duration/resolution/format;
- complexity and number of scenes;
- script/voice-over/subtitles;
- variants and aspect ratios;
- source cleanup;
- brand consistency;
- revision allowance;
- delivery timing;
- usage license.

Do not sell only AI credits or prompt counts.

## 5. Competitive benchmark

For each category, compare equivalent freelancer/agency offers using a documented sample:
- deliverable count and quality;
- duration/resolution;
- revision count;
- usage rights;
- turnaround;
- tax and platform fees;
- included creative direction.

The comparison must be fair and dated. A low-priced freelancer with a narrower scope is not a valid comparator.

## 6. Margin and price controls

Before launch:
- define target contribution margin;
- test at least a small batch of real or authorized pilot orders;
- include failed-generation cost and QA time;
- validate provider price and payment fees;
- set a minimum acceptable price;
- cap revisions and usage;
- define refund/redo thresholds.

Pause or reprice an offer if actual contribution becomes negative or provider costs change materially.

## 7. Customer-facing transparency

Display exact scope, included outputs, add-ons, revision rules, delivery assumptions, payment schedule and license. Never display internal provider costs or promise savings that have not been substantiated.

## 8. Payment compatibility

The existing approved AVORLUNE production policy remains 50% deposit before production and 50% balance before final unwatermarked delivery. This document does not authorize changing payment policy or activating Duitku. See docs/59 and the payment release gates in README.

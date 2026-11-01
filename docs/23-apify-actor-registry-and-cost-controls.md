# Apify Actor Registry & Cost Controls

> **PROPOSAL — not implemented.** No Apify token, connector, migration or paid run exists. Any run requires explicit owner budget approval.

Status: DISCOVERED / NOT EXECUTED. Pricing changes; re-fetch details immediately before any run.

| Platform | Actor | Intended use | Observed pricing snapshot | Decision |
|---|---|---|---|---|
| TikTok | https://apify.com/scrapeforge/tiktok-posts | Public post discovery and metadata | Pay per event; prior inspection showed start and result events | Candidate; no run |
| Instagram | https://apify.com/apify/instagram-scraper | Public profiles, posts, Reels, hashtags and comments | Pay per result; prior inspection showed USD 0.0027/result on FREE tier | Preferred candidate; no run |
| YouTube | https://apify.com/johnvc/YoutubeTranscripts | Public video transcripts | Pay per event; prior inspection showed USD 0.00275/transcript | Optional; no run |
| YouTube | https://apify.com/supreme_coder/youtube-transcript-scraper | Transcript alternative | Pricing must be rechecked | Backup |

Prior discovery snapshot: TikTok candidate had low review count; Instagram Actor is official Apify with substantial adoption; YouTube transcript Actor is community-developed. Adoption does not guarantee quality or compliance.

## Cost policy
- Default budget: USD 0 / Rp0.
- No Actor execution until user explicitly approves a maximum charge or confirms that the run is covered by free credits at zero charge.
- Before execution: fetch current Actor details, schema, README and pricing.
- For pay-per-result Actors, set Actor-native result limits and maxItems.
- For pay-per-event Actors, set maxTotalChargeUsd and Actor-native limits.
- Caps are safeguards, not substitutes for correct input.
- Start with the smallest useful pilot; inspect quality before expansion.
- Record estimated/actual cost, run ID, item count and date.
- Stop at the approved ceiling.

## Approval record
Required: Actor, purpose, target URLs/keywords, max items, max USD, confirmation of zero-cost credits if applicable, approval date and operator. Never store tokens or credentials.

## No-run declaration
Prior discovery inspected Actors and pricing only. It did not execute scraping or spend credits. This registry does not assert that free execution quota is available.

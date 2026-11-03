# 81 — Customer Journey & UI/UX Gap Analysis

Status: Implementation specification / audit baseline  
Date: 2026-11-03  
Scope: Public AVORLUNE customer experience, from first visit through final delivery. This document describes observed source-code facts and the target experience; it does not claim the target is already implemented.

## 1. Executive finding

AVORLUNE has substantial backend and page-level functionality, but the customer experience is not yet a coherent, guided, end-to-end journey. The main gap is not simply missing endpoints. It is the absence of a visible, persistent journey model that connects discovery, account creation, onboarding, catalogue selection, brief creation, quotation, deposit, production, review, balance payment, and delivery.

The application currently behaves like a conventional marketing website with a collection of routes. A customer can reach some features, but is not consistently guided from one stage to the next, and important steps are conditional on operational states that may not be visible to the customer.

## 2. Evidence-based source audit

The following observations were verified in the Public repository source on branch main during this audit:

| Source | Observed behavior | UX consequence |
|---|---|---|
| `src/App.tsx` | Routes exist for home, services, work, process, start, catalog, demo, sign-in, sign-up, account and project link. | Routes existing does not ensure that users can discover them or move between them. |
| `src/components/SiteLayout.tsx` | Main navigation contains Catalog, Work, Process, Demo, About, Contact, conditional AccountNav, and Start Project. | No visible stepper or journey navigation; account navigation is hidden when Clerk is disabled or still loading. |
| `src/pages/HomePage.tsx` | Main CTA points to `/start`; secondary CTA points to process. | The primary conversion action does not explicitly explain the account-first flow. |
| `src/lib/auth.tsx` | Clerk config is fetched at runtime. If there is no publishable key, customer auth is disabled and the site continues rendering. | A production visitor can see the website without a usable sign-in route or clear next step. |
| `src/pages/AccountPages.tsx` | SignIn and SignUp use Clerk components; onboarding is an optional panel inside AccountPage after sign-in. | Onboarding is not a first-class required step in the signup journey. |
| `src/pages/StartProjectPage.tsx` | Brief submission only redirects to sign-in when `briefRequiresAccount` is true. The documented default is off. Guest form and sessionStorage draft are supported. | Customer can begin and submit without first registering, contrary to the intended account-first funnel. |
| `src/pages/CatalogPages.tsx` | Catalog and detail pages are public; CTA begins a brief. | Catalogue selection is not presented as a tracked stage in a customer journey. |
| `src/pages/CustomerProjectPage.tsx` | Project portal contains quote decision, payment panel, action authorization, review, asset download, timeline and support, depending on API state. | Rich functionality is hidden until the customer has a private project link; the UI does not expose a clear lifecycle overview from the account dashboard. |
| `docs/80-unified-platform-implementation-and-gap-register.md` | Documents Clerk Development, account, catalog, payment milestones and action services as delivered; says `CUSTOMER_AUTH_REQUIRED_FOR_BRIEF` defaults off. | Documentation confirms the account-first behavior is not enforced by default. |

Important distinction: this audit reviewed source and route declarations. It did not perform a real browser session, inspect the live DOM across devices, verify the Clerk Dashboard Google provider settings, or prove that every production/preview deployment serves the same commit.

## 3. Root cause categories

### 3.1 Discovery and navigation gap
- No guided customer journey or progress indicator.
- No consistent “Continue your project” entry point.
- Account, catalogue, brief, project status and payment are separate destinations.
- A feature route may exist without any contextual CTA that takes a customer there.
- Empty states do not consistently recommend the next best action.

### 3.2 Authentication and onboarding gap
- Clerk is optional at runtime when no publishable key is configured.
- Google OAuth provider availability depends on Clerk Dashboard configuration and has not been verified by a real browser login.
- Sign-up and sign-in pages exist, but onboarding is optional and lives inside Account.
- The intended account-first customer journey is not enforced because the brief auth requirement defaults off.
- Production currently has no customer Clerk instance, so the target journey cannot be considered production-ready.

### 3.3 Catalogue-to-brief continuity gap
- Catalogue is browsable, but a customer needs a clear explanation of what to choose.
- Selection context must persist from catalogue detail into the brief (catalog item, offer version, service type).
- A customer should understand what is known, what needs a quote, and what happens after submitting.
- Do not fabricate pricing or promise fixed delivery dates. Quote-required items must remain clearly marked as “Harga melalui penawaran”.

### 3.4 Project lifecycle visibility gap
- Project operations are available in the project-link page, but the account dashboard does not yet serve as a complete customer workspace.
- The customer should see one ordered status path: brief received → review → quotation → quote accepted → deposit → production → preview/review → revisions if any → final approval → balance → delivery.
- Each stage needs status, explanation, next action, expected owner (customer/team), and a meaningful empty/loading/error state.
- Payment and delivery gates must be explained before the customer reaches a blocked action.

### 3.5 Real-interactivity gap
A visible control is only complete when it:
1. Has an explicit user action and accessible state.
2. Calls the correct authenticated API or navigation target.
3. Handles loading, success, validation, failure, retry and empty states.
4. Persists data where appropriate.
5. Refreshes or reconciles the UI from authoritative server state.
6. Has automated tests and at least one end-to-end browser test for critical journeys.

A component, route, API endpoint, mock card, or button with no working destination is not accepted as a delivered feature.

## 4. Target customer experience

### 4.1 Public discovery layer
The public marketing site may remain readable without an account so visitors can understand the brand, services, examples and process. However, any action that starts a customer relationship or stores customer data must enter the account-first flow.

Primary calls to action:
- “Mulai perjalanan” / “Buat akun”
- “Lihat katalog”
- “Lihat cara kerja”
- Contextual “Pilih layanan ini” from catalogue detail

When a visitor selects an action that begins a project, the system must require Google sign-up/sign-in before continuing. Preserve the selected catalogue item and any draft state through authentication.

### 4.2 Required account-first journey
1. Visitor selects “Mulai” or a service.
2. Auth gate explains why an account is needed and offers **Continue with Google** as the primary method. Other providers may be shown only if explicitly approved and configured.
3. Google sign-in/sign-up completes through Clerk.
4. First-time customer enters a welcome/onboarding flow.
5. Onboarding collects only useful profile/context: display name, customer type (brand/business/creator/individual), primary goal, and optional preferred contact channel. Allow skip only for nonessential profile questions; do not allow skipping required legal consent.
6. Route to a customer home/dashboard with a clear next action and saved progress.
7. Customer browses catalogue, filters by need, opens a detail page, compares deliverables and selects an item.
8. Customer builds a structured brief with guided questions and optional references/budget/deadline.
9. Draft autosaves to the signed-in account; display saved state and recover after refresh or another device.
10. Customer reviews a summary and confirms submission.
11. Project is created in “brief received / pending review”. Explain that submission is not acceptance and creates no payment obligation.
12. Team reviews and sends a written quotation with scope, deliverables, exclusions, revision rounds, timing assumptions, total and offer version.
13. Customer accepts or rejects the quotation.
14. Upon acceptance, show payment schedule. DP is 50% of accepted total (ceil for odd minor-unit amount), balance is the remainder. No production until verified deposit.
15. After verified deposit, project moves to production queue. Customer sees progress and updates.
16. Team provides preview; customer submits consolidated feedback or approves the relevant deliverable.
17. Any externally impactful action (publish, post, send, activate) requires explicit customer authorization with visible scope and record.
18. Team prepares final deliverable. Customer sees balance due.
19. Customer pays remaining 50%; final download is enabled only after server verification.
20. Customer downloads final files, sees completion receipt, usage/licensing notes and support path.

### 4.3 Customer workspace navigation
Use a customer-facing navigation model, not admin navigation:
- Beranda / Dashboard
- Katalog
- Proyek Saya
- Brief Tersimpan (if drafts exist)
- Bantuan
- Account/profile menu

On mobile, use a clear compact navigation and persistent primary action. Never expose Admin or Studio navigation to customers.

### 4.4 Dashboard states
- New customer: welcome, onboarding completion, “Jelajahi katalog”, “Mulai brief”.
- Customer with draft: “Lanjutkan brief” with last saved time.
- Customer with active project: project card, lifecycle status, next action.
- Customer with multiple projects: grouped list, status and last update.
- Customer with quote: prominent decision and scope summary.
- Customer with deposit due: amount, due milestone, payment instructions/status.
- Customer in production: timeline and latest update.
- Customer with preview: review/feedback actions.
- Customer with balance due: outstanding amount and payment action.
- Customer completed: final download, receipt, licensing and support.

## 5. Page and interaction requirements

| Page / route | Required purpose | Required interactions |
|---|---|---|
| `/` | Explain value and guide first step | CTA to Google auth, catalogue, process; clear account state |
| `/sign-in` | Existing customer login | Google button visible, loading/error, return-to path |
| `/sign-up` | New account | Google button visible, account creation and return-to path |
| `/onboarding` | First-session setup | Stepper, validation, skip optional fields, save and continue |
| `/catalog` | Discover offers | Search/filter, cards, availability/price mode, detail links |
| `/catalog/:slug` | Evaluate offer | Deliverables, requirements, pricing policy, CTA with selected offer |
| `/start` or `/brief/new` | Build brief | Multi-step form, validation, autosave, resume, selected offer context |
| `/brief/review` | Confirm brief | Summary, edit links, consent, submit |
| `/account` | Customer workspace | Overview, drafts, projects, next actions |
| `/projects/:reference` | Project detail | Quote, payment, timeline, action approvals, review, files, support |
| `/help` | Resolve issues | Contact/support form, relevant policy links |

Routes can be adapted to the existing React Router structure. Avoid duplicate routes that create two sources of truth.

## 6. Interaction contract and definition of done

For every CTA, link, tab, card, form, menu and modal:
- State the intended destination/action in the UI inventory.
- Confirm it is reachable from at least one visible customer journey.
- Confirm route guards and redirects preserve intended destination.
- Confirm server-side authorization independently of UI visibility.
- Add loading, disabled, success, error and retry states.
- Add keyboard/focus behavior and mobile layout.
- Add tests for click → API/navigation → resulting state.
- Do not leave placeholder links, `href="#"`, inert buttons, dead-end empty states, fake success, or demo data in live customer routes.

## 7. Payment and business invariants

- No customer charge before accepted written quotation.
- DP must be verified at exactly the next payable milestone before production begins. No ordinary staff reason may bypass this gate.
- Balance must be verified before final delivery and final download.
- Amount and milestone are computed server-side; browser cannot choose arbitrary amount.
- Duitku remains disabled until merchant credentials are verified and owner explicitly approves activation.
- Manual payment confirmation must require the existing step-up security and exact milestone amount.
- Preserve immutable offer version attached to the project.
- Do not imply automated production, posting, delivery or email when the workflow is still staff-operated.

## 8. Authentication and privacy requirements

- Google sign-in is the required primary customer authentication method for the account-first flow. Verify provider configuration in Clerk Dashboard and test a real browser flow.
- Do not collect Google passwords or OAuth codes in AVORLUNE.
- Clerk subject is the immutable identity mapping; email is an attribute, not proof of project ownership.
- Customer data queries must be scoped to the authenticated internal customer ID.
- Preserve signed project links as a compatibility path until migration is tested; never auto-claim projects by matching email.
- Do not expose customer account routes when auth is disabled without a clear, truthful unavailable state.
- Preview and production must use separate Clerk instances/keys and separate D1 bindings.
- No secrets in frontend bundles, source, logs, screenshots or prompts.

## 9. Prioritized gap register

| ID | Priority | Gap | Required resolution | Acceptance evidence |
|---|---|---|---|---|
| CJ-001 | P0 | Account-first flow not enforced by default | Require customer auth before brief creation/submission; preserve redirect and selected offer | Guest CTA redirects to auth; after Google login returns to intended journey |
| CJ-002 | P0 | Google provider not verified end-to-end | Configure/verify Clerk Google OAuth and run browser test in preview | Successful new user + existing user browser login, callback, refresh, logout |
| CJ-003 | P0 | Onboarding is optional panel inside Account | Dedicated first-session onboarding route/flow | New user routed to onboarding; saved completion persists; return user bypasses it |
| CJ-004 | P0 | Home CTA does not communicate account-first process | Update CTA and explain steps before starting | CTA leads to account gate and resumes intended route |
| CJ-005 | P0 | Customer journey not visible as a connected flow | Add progress stepper, dashboard next action and lifecycle timeline | Every project state displays next action and owner |
| CJ-006 | P0 | Catalog-to-brief context continuity needs verification | Preserve catalog slug and immutable offer version through auth and brief | Selected item appears in brief and resulting project |
| CJ-007 | P1 | Account dashboard is not a complete workspace | Add draft, projects, quotes, payment due, production, review and delivery summaries | Scenario tests for each dashboard state |
| CJ-008 | P1 | Customer portal may be a dead-end from account | Add clear project-detail entry and back navigation | Customer can move dashboard → project → dashboard |
| CJ-009 | P1 | UI interactions not audited systematically | Build route/CTA/action inventory and E2E tests | No dead CTA; interaction checklist passes |
| CJ-010 | P1 | Auth-disabled production experience is misleading/incomplete | Add explicit launch readiness guard and truthful sign-in status | Production never implies account signup works before Clerk production is configured |
| CJ-011 | P1 | Brief is long and intimidating | Multi-step guided brief, progress, examples, autosave, review summary | Complete brief on mobile and desktop with validation/recovery |
| CJ-012 | P2 | No systematic UI observability | Capture route errors, failed API actions and correlation IDs without sensitive data | Errors traceable without exposing PII/secrets |

## 10. Implementation sequence

1. Map every current route, navigation item, CTA, button and API action.
2. Create a route/interaction matrix with status: working, disconnected, inaccessible, broken, placeholder, or unverified.
3. Implement auth gate and Google login verification in preview.
4. Build dedicated onboarding and redirect/resume logic.
5. Make catalogue-to-brief selection continuous.
6. Build multi-step brief, account draft persistence and review/submit.
7. Build customer dashboard and lifecycle next-action cards.
8. Connect quote/payment/project/review/delivery states.
9. Add accessible responsive design and empty/loading/error states.
10. Add browser E2E coverage for complete journeys.
11. Update docs and report evidence.
12. Production cutover only after separate Clerk Production setup and explicit owner approval.

## 11. Release acceptance scenarios

- New visitor → Google signup → onboarding → catalogue → select offer → brief → review → submit → dashboard.
- Existing customer → Google signin → dashboard → resume saved draft → submit.
- Visitor selects a catalogue item before auth → Google signin → returns to same item and starts the correct brief.
- Customer receives quotation → reviews scope → accepts → sees exact DP.
- Customer attempts production before verified DP → blocked.
- Customer pays verified DP → sees production progress.
- Customer reviews preview → requests revision → sees updated state.
- Customer approves final → pays balance → downloads final file.
- Customer A cannot see Customer B's projects, briefs, payments, assets or support records.
- Auth provider unavailable → clear error/retry and no fake successful account state.
- Mobile viewport → all primary journey steps and actions remain usable.

## 12. Explicit non-goals and approvals

This customer-journey work does not authorize:
- Production Clerk activation or changing Google OAuth credentials without owner approval.
- Duitku activation, live payment creation, or paid transactions.
- R2 provisioning, paid storage, Resend activation or external data transfer.
- Automatic posting/publication or unsupervised external actions.
- Deleting or claiming legacy project records.
- Replacing the existing Admin authentication or exposing Admin to customers.

The goal is a real, navigable and testable customer journey—not a visual mockup or documentation-only completion.

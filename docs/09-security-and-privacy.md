# 09 — Security & Privacy Baseline

## Data classification
- Public: approved portfolio assets, published service information.
- Internal: pricing logic, production notes, staff-only records.
- Customer-confidential: briefs, uploaded source files, previews and final deliverables.
- Secrets: API keys, auth secrets, webhook secrets and storage credentials.

## Minimum controls
1. Store secrets only in Cloudflare secrets or an approved secret manager.
2. Never commit `.env`, API keys, cookies, session tokens or customer files.
3. Use least-privilege service credentials and rotate compromised secrets.
4. Enforce role and project authorization on every server request.
5. Keep R2 buckets private; serve assets through short-lived signed access or an authenticated proxy.
6. Validate file size, MIME type and file signatures; reject executable content.
7. Apply rate limits and spam controls to public inquiry endpoints.
8. Use secure, HttpOnly, SameSite cookies if cookie sessions are used.
9. Protect state-changing cookie-authenticated requests against CSRF.
10. Redact contact details, brief text, tokens and signed URLs from logs.
11. Record admin actions and project status changes.
12. Use separate preview and production resources.
13. Define backup, retention and deletion processes before production launch.

## Privacy principles
- Collect only information needed to scope and deliver a project.
- Explain why uploaded materials are collected and how long they are retained.
- Do not reuse customer work in portfolio or training without explicit permission.
- Do not send confidential customer assets to an AI provider unless the customer terms and provider data policy permit it.
- Provide a contact route for access, correction and deletion requests.
- Publish accurate privacy terms before accepting real customer data.

## Incident response
On suspected exposure: disable affected credentials/links, preserve relevant security logs, assess affected projects, notify impacted parties as legally required, rotate secrets and document remediation. Do not silently dismiss an incident.

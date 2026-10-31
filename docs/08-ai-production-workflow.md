# 08 — AI Creative Production Workflow

## Operating model
AI-assisted production with human creative direction and quality control. The portal manages the job; it does not promise fully autonomous generation.

## Workflow
1. **Brief intake:** capture objective, audience, product facts, channel, aspect ratio, references, mandatory claims and prohibited content.
2. **Qualification:** producer checks feasibility, source-material rights, deadlines and missing information.
3. **Creative direction:** define concept, visual references, storyboard or image direction, deliverable specs.
4. **Scope and quote:** record deliverables, included revisions, timeline, usage rights and price.
5. **Payment gate:** begin production after payment confirmation or documented approved exception.
6. **Production:** use approved tools and workflows. Keep provider-specific logic behind adapters where APIs exist.
7. **Internal review:** inspect factual accuracy, brand consistency, artifact defects, safety, likeness/voice permissions and output specifications.
8. **Customer review:** share private previews and collect consolidated feedback.
9. **Revision:** track round count against agreed scope; quote out-of-scope changes separately.
10. **Approval and delivery:** customer approval is recorded; final assets are delivered privately with usage terms.

## Provider adapter interface (conceptual)
- capabilities()
- estimate(input)
- submitJob(input)
- getJobStatus(providerJobId)
- retrieveOutput(providerJobId)
- cancelJob(providerJobId)

Implement only after the provider's official API, account access, pricing, data handling and commercial-use rights are confirmed. A desktop app or web UI is not proof of API access.

## Quality checklist
- Matches the approved brief and creative direction.
- Product appearance and brand assets are not materially misrepresented.
- Text, logos and product claims are checked.
- Video duration, aspect ratio, resolution and audio are correct.
- No accidental watermark or unauthorized third-party asset.
- Human review completed and recorded.
- Customer usage rights and any restrictions are stated.

## Rights and consent
Customers must confirm they have rights to uploaded references, logos, music, footage and likenesses. Obtain explicit permission for identifiable people, voice cloning or sensitive depictions. Use only tools/assets whose terms permit the intended commercial use. Do not imply exclusive ownership if provider terms do not grant it.

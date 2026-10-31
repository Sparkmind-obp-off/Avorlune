# 06 — Data Model

Use UUID/ULID identifiers generated server-side. Store timestamps in UTC ISO-8601. Use explicit status enums in application code and constrain values in the database where practical.

## Tables

### users
- id (PK)
- email (unique, normalized)
- display_name
- role: customer | producer | admin
- auth_subject (nullable; external auth identity)
- created_at, updated_at

### projects
- id (PK)
- public_reference (unique, non-sequential)
- customer_user_id (FK users; nullable for guest inquiries until claimed)
- customer_name
- customer_contact
- service_type: image | video | mixed
- title
- objective
- brief_json
- intended_use
- requested_deadline (nullable)
- status: inquiry | qualifying | quoted | awaiting_payment | queued | producing | internal_review | customer_review | revision | approved | delivered | cancelled
- created_at, updated_at

### quotes
- id (PK)
- project_id (FK)
- currency (default IDR)
- amount_minor (integer)
- scope_json
- included_revision_rounds
- estimated_delivery_at (nullable)
- status: draft | sent | accepted | rejected | expired
- accepted_at (nullable)
- created_at, updated_at

### payments
- id (PK)
- project_id (FK)
- amount_minor
- currency
- method
- provider_reference (nullable)
- status: pending | manually_confirmed | paid | failed | refunded
- confirmed_by (nullable FK users)
- confirmed_at (nullable)
- created_at, updated_at

### assets
- id (PK)
- project_id (FK)
- uploaded_by (FK users; nullable for system)
- storage_key (unique; never expose as public URL)
- asset_kind: customer_reference | preview | final | source
- mime_type
- size_bytes
- checksum (nullable)
- version
- visibility: private
- created_at

### feedback
- id (PK)
- project_id (FK)
- asset_id (nullable FK)
- submitted_by (FK users)
- message
- revision_round
- status: open | acknowledged | resolved
- created_at

### project_events
- id (PK)
- project_id (FK)
- actor_user_id (nullable FK users)
- event_type
- from_status (nullable)
- to_status (nullable)
- safe_metadata_json
- created_at

## Relationships
- A customer may have many projects.
- A project may have multiple quotes, payments, assets, feedback records and events.
- A quote belongs to one project.
- Asset access is mediated by project authorization, not by guessing storage keys.

## Data rules
- Never store card data.
- Do not place private file URLs in public portfolio records.
- Do not put credentials, access tokens or full sensitive brief contents in audit metadata.
- Store money as integer minor units, never floating point.
- Define retention and deletion behavior before public launch.

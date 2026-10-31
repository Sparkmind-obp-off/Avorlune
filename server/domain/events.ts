import { newId, nowIso } from '../lib/http'

export type ActorType = 'system' | 'customer' | 'admin'

/** Build an audit event statement. Metadata must never contain contact details, brief text or tokens. */
export function eventStmt(
  db: D1Database,
  e: { projectId: string; actorUserId?: string | null; actorType: ActorType; eventType: string; fromStatus?: string | null; toStatus?: string | null; metadata?: Record<string, unknown> },
) {
  return db
    .prepare(
      `INSERT INTO project_events (id, project_id, actor_user_id, actor_type, event_type, from_status, to_status, safe_metadata_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(newId(), e.projectId, e.actorUserId ?? null, e.actorType, e.eventType, e.fromStatus ?? null, e.toStatus ?? null, JSON.stringify(e.metadata ?? {}), nowIso())
}

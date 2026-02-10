import type { Database } from './db';
import { auditLog } from './db/schema';

type AuditParams = {
  workspaceId?: string;
  showId?: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

export async function logAuditEvent(db: Database, params: AuditParams) {
  await db.insert(auditLog).values({
    workspaceId: params.workspaceId,
    showId: params.showId,
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  });
}

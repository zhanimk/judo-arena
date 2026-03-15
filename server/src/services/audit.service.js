const AuditLog = require('../models/AuditLog');

async function recordAuditEvent({
  actorId,
  actorRole,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  reason = null,
  meta = null,
}) {
  return AuditLog.create({
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    before,
    after,
    reason,
    meta,
  });
}

module.exports = {
  recordAuditEvent,
};
/**
 * Single write path for the two audit tables (T9/D8). Callers pass `db` as
 * either the shared pool or a transaction client so ECO/txn flows stay atomic.
 * Logging is best-effort at the call site: keep the caller's try/catch when a
 * failed audit row must not fail the request.
 */

export const logActivity = async (db, {
  componentId = null,
  userId = null,
  partNumber = '',
  activityType,
  details = null,
}) => {
  await db.query(
    `INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [componentId, userId, partNumber, activityType, details == null ? null : JSON.stringify(details)],
  );
};

export const logUserActivity = async (db, { typeName, description, userId = null }) => {
  await db.query(
    `INSERT INTO user_activity_log (type_name, description, user_id)
     VALUES ($1, $2, $3)`,
    [typeName, description, userId],
  );
};

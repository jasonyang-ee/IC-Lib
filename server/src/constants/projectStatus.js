// §V33: projects.status is a closed lifecycle domain, on parity with
// components.approval_status and eco_orders.status. This list is the single
// source of truth for the API boundary check; the DB CHECK constraint
// (migration 16 + init-schema.sql) mirrors it and is the backstop.
export const PROJECT_STATUSES = Object.freeze(['active', 'completed', 'archived']);

// A value is acceptable when it is omitted (create defaults to 'active';
// update treats absence as "no change") or is a member of the domain.
export const isValidProjectStatus = status =>
  status === undefined || status === null || PROJECT_STATUSES.includes(status);

import { inspectDatabaseSchema } from '../services/schemaInspectionService.js';
import { logError } from '../utils/logger.js';

// Liveness (SPEC §V30): process is up. Cheap, no DB touch. Always 200 while the
// event loop runs. Orchestrators MUST NOT consume this as a routing signal -
// the app can be alive but unable to serve (DB down); that is readiness.
export const liveness = (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

// Readiness (SPEC §V30): can the app actually serve? One live, uncached full
// schema inspection answers both halves at once - a rejected query means the
// database is unreachable, and `valid:false` means the schema cannot serve the
// API surface. Anything short of `valid:true` is 503, never 200. This is the
// signal the Docker HEALTHCHECK / compose / k8s probe consumes.
//
// The probe is unauthenticated, so the body carries only the routing signal.
// Which table, view or column is missing - and the driver error itself - go to
// the server log, never to the caller.
export const readiness = async (_req, res) => {
  const notReady = () => res.status(503).json({
    status: 'not ready',
    timestamp: new Date().toISOString(),
  });

  let schema;
  try {
    schema = await inspectDatabaseSchema();
  } catch (error) {
    logError('Health', 'Readiness schema inspection failed:', error.message);
    return notReady();
  }

  if (!schema.valid) {
    const missingColumns = schema.missingColumns.map(({ table, column }) => `${table}.${column}`);
    logError(
      'Health',
      `Readiness schema incomplete: tables=[${schema.missingTables}] views=[${schema.missingViews}] columns=[${missingColumns}]`,
    );
    return notReady();
  }

  return res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
};

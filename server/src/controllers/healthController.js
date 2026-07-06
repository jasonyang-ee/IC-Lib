import pool from '../config/database.js';
import { getAuthenticationStatus } from '../services/initializationService.js';

// Liveness (SPEC §V30): process is up. Cheap, no DB touch. Always 200 while the
// event loop runs. Orchestrators MUST NOT consume this as a routing signal -
// the app can be alive but unable to serve (DB down); that is readiness.
export const liveness = (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

// Readiness (SPEC §V30): can the app actually serve? = DB reachable + schema
// verified. DB unreachable or schema not ready -> 503, never 200. This is the
// signal the Docker HEALTHCHECK / compose / k8s probe consumes.
export const readiness = async (_req, res) => {
  // 1. DB reachability: a cheap ping. A failed pool query here means the DB is
  //    down or the pool is exhausted - not ready.
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    return res.status(503).json({
      status: 'not ready',
      database: 'unreachable',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }

  // 2. Schema verified: users table + schema + default admin present. A DB that
  //    answers SELECT 1 but has not finished initialization is not ready to
  //    serve either.
  const authentication = await getAuthenticationStatus();
  if (!authentication.ready) {
    return res.status(503).json({
      status: 'not ready',
      database: 'up',
      authentication,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    status: 'ready',
    database: 'up',
    authentication,
    timestamp: new Date().toISOString(),
  });
};

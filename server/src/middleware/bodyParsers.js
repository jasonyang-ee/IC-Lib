import express from 'express';
import { SCIM_BASE_PATH } from '../services/scimService.js';

const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });
const SCIM_PREFIX = `${SCIM_BASE_PATH}/`;

const isScimPath = (requestPath) => requestPath === SCIM_BASE_PATH
  || requestPath.startsWith(SCIM_PREFIX);

/**
 * Parse ordinary app requests in the existing JSON-then-form order. SCIM is
 * deliberately left untouched so its router can authenticate before reading
 * a request body.
 */
export const appBodyParsers = (req, res, next) => {
  if (isScimPath(req.path)) {
    return next();
  }

  return jsonParser(req, res, (jsonError) => {
    if (jsonError) {
      return next(jsonError);
    }
    return urlencodedParser(req, res, next);
  });
};


import { isIP } from 'net';

const SERVER_BIND_HOST_ERROR = 'SERVER_BIND_HOST must be an IPv4 or IPv6 address';

/**
 * Node accepts hostnames, but a fixed IP literal makes the listener topology
 * auditable: container nginx can use loopback while direct deployments choose
 * their own explicit interface.
 */
export function parseServerBindHost(value = process.env.SERVER_BIND_HOST) {
  if (value === undefined || value === null) {
    return '0.0.0.0';
  }

  const host = String(value).trim();
  if (!host || isIP(host) === 0) {
    throw new Error(SERVER_BIND_HOST_ERROR);
  }

  return host;
}

const TRUST_PROXY_ERROR = 'TRUST_PROXY_HOPS must be a non-negative integer';

export function parseTrustProxyHops(value = process.env.TRUST_PROXY_HOPS) {
  if (value === undefined || value === null) {
    return 0;
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(TRUST_PROXY_ERROR);
  }

  const hops = Number(normalized);
  if (!Number.isSafeInteger(hops)) {
    throw new Error(TRUST_PROXY_ERROR);
  }

  return hops;
}

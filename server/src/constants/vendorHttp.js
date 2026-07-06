// §V34: every outbound vendor HTTP call (DigiKey, Mouser, footprint fetch) is
// bounded by this timeout. axios defaults to no timeout, so a hung upstream
// would otherwise hold the request open indefinitely and, inside the admin
// bulk stock/spec refresh (§V24), stall the whole batch. A bounded call throws
// (ECONNABORTED) instead, and the bulk loop treats that item as a skip.
// Env-tunable for ops; default 15s.
export const VENDOR_HTTP_TIMEOUT_MS = Number(process.env.VENDOR_HTTP_TIMEOUT_MS) || 15000;

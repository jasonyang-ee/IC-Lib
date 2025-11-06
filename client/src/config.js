/**
 * Runtime Configuration
 * This file provides access to runtime configuration injected by the server.
 * Configuration is loaded from /config.js which is generated at container startup.
 */

const getConfig = () => {
  // Access the runtime config injected by the server
  return window.__RUNTIME_CONFIG__ || {};
};

export const isECOEnabled = () => {
  const config = getConfig();
  return config.CONFIG_ECO === 'true' || config.CONFIG_ECO === true;
};

export const getAPIUrl = () => {
  const config = getConfig();
  return config.API_URL || '/api';
};

// Export the full config for debugging
export const getRuntimeConfig = getConfig;

export default {
  isECOEnabled,
  getAPIUrl,
  getRuntimeConfig
};

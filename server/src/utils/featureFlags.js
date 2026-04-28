export const parseBooleanEnv = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const resolveBooleanEnv = (...values) => {
  for (const value of values) {
    if (value !== undefined) {
      return parseBooleanEnv(value);
    }
  }

  return false;
};

export const isEcoEnabled = () => resolveBooleanEnv(process.env.CONFIG_ECO, process.env.VITE_CONFIG_ECO);

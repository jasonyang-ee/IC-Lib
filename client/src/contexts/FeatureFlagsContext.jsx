import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

const buildTimeFeatureFlags = {
  ecoEnabled: import.meta.env.VITE_CONFIG_ECO === 'true',
};

const FeatureFlagsContext = createContext({
  ...buildTimeFeatureFlags,
  isLoading: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useFeatureFlags = () => {
  return useContext(FeatureFlagsContext);
};

export const FeatureFlagsProvider = ({ children }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      try {
        const response = await api.getFeatureFlags();
        return {
          ecoEnabled: response.data?.ecoEnabled ?? buildTimeFeatureFlags.ecoEnabled,
        };
      } catch {
        return buildTimeFeatureFlags;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <FeatureFlagsContext.Provider
      value={{
        ecoEnabled: data?.ecoEnabled ?? buildTimeFeatureFlags.ecoEnabled,
        isLoading,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
};
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Check, Loader2, Plus, X } from 'lucide-react';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { buildCanonicalName } from '../../utils/packageNaming';

const EMPTY_PACKAGE = { short_name: '', family: '', mount: '', count_policy: 'append' };

// The count policy decides whether a pin count reaches the canonical name.
const COUNT_POLICIES = [
  { value: 'chip', label: 'Chip size code', hint: 'The size code is the whole identity' },
  { value: 'embedded', label: 'Count already in the name', hint: 'The short name already ends in its pin count' },
  { value: 'none', label: 'No pin count', hint: 'The pin count is not part of the identity' },
  { value: 'append', label: 'Append pin count', hint: 'The pin count is appended to the short name' },
];

const exampleName = (shortName, countPolicy) => buildCanonicalName({
  shortName: shortName || 'SOIC',
  pinCount: '8',
  density: 'B',
  countPolicy,
}) || 'no name without a pin count';

const PackageCatalogManager = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [newPackage, setNewPackage] = useState(EMPTY_PACKAGE);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [tempPackage, setTempPackage] = useState(EMPTY_PACKAGE);
  const [newAlias, setNewAlias] = useState({});

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await api.getPackages();
      return response.data;
    },
  });

  // Every catalog mutation refreshes the list and reports the server's message.
  const catalogMutation = (mutationFn, successMessage) => ({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      showSuccess(successMessage);
    },
    onError: (error) => {
      showError(error.response?.data?.error || error.message);
    },
  });

  const createPackageMutation = useMutation(catalogMutation(
    async (data) => api.createPackage(data), 'Package created successfully',
  ));
  const updatePackageMutation = useMutation(catalogMutation(
    async ({ id, data }) => api.updatePackage(id, data), 'Package updated successfully',
  ));
  const deletePackageMutation = useMutation(catalogMutation(
    async (id) => api.deletePackage(id), 'Package removed successfully',
  ));
  const createAliasMutation = useMutation(catalogMutation(
    async ({ id, alias }) => api.createPackageAlias(id, alias), 'Alias added successfully',
  ));
  const deleteAliasMutation = useMutation(catalogMutation(
    async ({ id, aliasId }) => api.deletePackageAlias(id, aliasId), 'Alias removed successfully',
  ));
  const promoteAliasMutation = useMutation(catalogMutation(
    async ({ id, alias }) => api.promotePackageAlias(id, alias), 'Alias promoted to canonical name',
  ));

  const startEditing = (packageRow) => {
    setEditingPackageId(packageRow.id);
    setTempPackage({
      short_name: packageRow.short_name,
      family: packageRow.family || '',
      mount: packageRow.mount || '',
      count_policy: packageRow.count_policy,
    });
  };

  const countPolicyControl = (value, onChange, shortName) => (
    <div>
      <div className="flex flex-wrap gap-2">
        {COUNT_POLICIES.map((policy) => (
          <button
            key={policy.value}
            type="button"
            onClick={() => onChange(policy.value)}
            className={`px-3 py-1 text-xs rounded-lg border ${value === policy.value
              ? 'bg-primary-600 text-white border-primary-600'
              : 'border-gray-300 dark:border-[#444444] text-gray-700 dark:text-gray-300'}`}
          >
            {policy.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        {COUNT_POLICIES.find((policy) => policy.value === value)?.hint} — an 8-pin part becomes{' '}
        <span className="font-mono">{exampleName(shortName, value)}</span>
      </p>
    </div>
  );

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Package Catalog</h2>
        <button
          onClick={() => { setIsAddingPackage(true); setNewPackage(EMPTY_PACKAGE); }}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Package
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Canonical package names and their aliases. CAD filename sanitization and the parts package field both resolve
        through this catalog.
      </p>

      {isAddingPackage && (
        <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newPackage.short_name}
              onChange={(event) => setNewPackage({ ...newPackage, short_name: event.target.value })}
              placeholder="Short name"
              aria-label="New package short name"
              className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
            />
            <input
              type="text"
              value={newPackage.family}
              onChange={(event) => setNewPackage({ ...newPackage, family: event.target.value })}
              placeholder="Family (optional)"
              aria-label="New package family"
              className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
            />
            <input
              type="text"
              value={newPackage.mount}
              onChange={(event) => setNewPackage({ ...newPackage, mount: event.target.value })}
              placeholder="Mount (optional)"
              aria-label="New package mount"
              className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
            />
          </div>
          {countPolicyControl(
            newPackage.count_policy,
            (value) => setNewPackage({ ...newPackage, count_policy: value }),
            newPackage.short_name,
          )}
          <div className="flex gap-2">
            <button
              onClick={() => createPackageMutation.mutate(newPackage, { onSuccess: () => setIsAddingPackage(false) })}
              disabled={!newPackage.short_name.trim() || createPackageMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg flex items-center gap-2"
            >
              {createPackageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Package
            </button>
            <button
              onClick={() => setIsAddingPackage(false)}
              className="border border-gray-300 dark:border-[#444444] text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {packages.map((packageRow) => (
            <div key={packageRow.id} className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4">
              {editingPackageId === packageRow.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={tempPackage.short_name}
                      onChange={(event) => setTempPackage({ ...tempPackage, short_name: event.target.value })}
                      aria-label={`Short name for ${packageRow.short_name}`}
                      className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
                    />
                    <input
                      type="text"
                      value={tempPackage.family}
                      onChange={(event) => setTempPackage({ ...tempPackage, family: event.target.value })}
                      aria-label={`Family for ${packageRow.short_name}`}
                      className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
                    />
                    <input
                      type="text"
                      value={tempPackage.mount}
                      onChange={(event) => setTempPackage({ ...tempPackage, mount: event.target.value })}
                      aria-label={`Mount for ${packageRow.short_name}`}
                      className="px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
                    />
                  </div>
                  {countPolicyControl(
                    tempPackage.count_policy,
                    (value) => setTempPackage({ ...tempPackage, count_policy: value }),
                    tempPackage.short_name,
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updatePackageMutation.mutate(
                        { id: packageRow.id, data: tempPackage },
                        { onSuccess: () => setEditingPackageId(null) },
                      )}
                      className="bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingPackageId(null)}
                      className="border border-gray-300 dark:border-[#444444] text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{packageRow.short_name}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                        {[packageRow.family, packageRow.mount, packageRow.count_policy].filter(Boolean).join(' | ')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(packageRow)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePackageMutation.mutate(packageRow.id)}
                        aria-label={`Delete ${packageRow.short_name}`}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {(packageRow.aliases || []).map((alias) => (
                      <span
                        key={alias.id}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-full px-2 py-1"
                      >
                        {alias.alias}
                        {alias.alias !== packageRow.short_name && (
                          <>
                            <button
                              onClick={() => promoteAliasMutation.mutate({ id: packageRow.id, alias: alias.alias })}
                              aria-label={`Promote ${alias.alias} to canonical`}
                              title="Make this the canonical name"
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteAliasMutation.mutate({ id: packageRow.id, aliasId: alias.id })}
                              aria-label={`Remove alias ${alias.alias}`}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <input
                      type="text"
                      value={newAlias[packageRow.id] || ''}
                      onChange={(event) => setNewAlias({ ...newAlias, [packageRow.id]: event.target.value })}
                      placeholder="Add alias"
                      aria-label={`New alias for ${packageRow.short_name}`}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-[#444444] dark:bg-[#1f1f1f] dark:text-gray-100 rounded-lg"
                    />
                    <button
                      onClick={() => createAliasMutation.mutate(
                        { id: packageRow.id, alias: newAlias[packageRow.id] },
                        { onSuccess: () => setNewAlias({ ...newAlias, [packageRow.id]: '' }) },
                      )}
                      disabled={!(newAlias[packageRow.id] || '').trim()}
                      className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white text-sm py-1 px-3 rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PackageCatalogManager;

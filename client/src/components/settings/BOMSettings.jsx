import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import {
  BOM_COLUMN_DEFINITIONS,
  DEFAULT_BOM_COLUMN_IDS,
  sanitizeBomColumnIds,
} from '../../utils/bomExport';

const areColumnListsEqual = (left, right) => (
  left.length === right.length && left.every((columnId, index) => columnId === right[index])
);

const BOMSettings = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [selectedColumnIds, setSelectedColumnIds] = useState([...DEFAULT_BOM_COLUMN_IDS]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const response = await api.getSettings();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const defaultColumnIds = useMemo(
    () => sanitizeBomColumnIds(settingsData?.bomDefaults?.columnIds),
    [settingsData?.bomDefaults?.columnIds],
  );

  const groupedColumns = useMemo(() => {
    const groups = new Map();

    for (const column of BOM_COLUMN_DEFINITIONS) {
      if (!groups.has(column.group)) {
        groups.set(column.group, []);
      }

      groups.get(column.group).push(column);
    }

    return Array.from(groups.entries());
  }, []);

  useEffect(() => {
    if (!hasChanges) {
      setSelectedColumnIds([...defaultColumnIds]);
    }
  }, [defaultColumnIds, hasChanges]);

  const saveBomDefaultsMutation = useMutation({
    mutationFn: async (columnIds) => {
      await api.updateSettings({
        bomDefaults: {
          columnIds,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setHasChanges(false);
      showSuccess('BOM defaults saved successfully!');
    },
    onError: (error) => {
      showError(`Error saving BOM defaults: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleToggleColumn = (columnId) => {
    setSelectedColumnIds((current) => {
      const nextColumns = current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId];

      setHasChanges(!areColumnListsEqual(nextColumns, defaultColumnIds));
      return nextColumns;
    });
  };

  const handleSelectAll = () => {
    const nextColumns = BOM_COLUMN_DEFINITIONS.map((column) => column.id);
    setSelectedColumnIds(nextColumns);
    setHasChanges(!areColumnListsEqual(nextColumns, defaultColumnIds));
  };

  const handleReset = () => {
    setSelectedColumnIds([...defaultColumnIds]);
    setHasChanges(false);
  };

  const handleSave = () => {
    if (selectedColumnIds.length === 0) {
      showError('Select at least one default BOM column');
      return;
    }

    saveBomDefaultsMutation.mutate(selectedColumnIds);
  };

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">BOM Defaults</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
            Choose the default metadata columns for project BOM exports. Users can still customize the selection in the Generate BOM popup.
            Distributor part numbers expand into one column per distributor, and alternative part columns are always appended automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          <button
            onClick={handleSelectAll}
            className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Select All
          </button>
          {hasChanges && (
            <button
              onClick={handleReset}
              className="font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {groupedColumns.map(([groupName, columns]) => (
          <div key={groupName}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wide">
              {groupName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {columns.map((column) => {
                const isSelected = selectedColumnIds.includes(column.id);

                return (
                  <label
                    key={column.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleColumn(column.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {column.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {column.description || `Include ${column.label.toLowerCase()} in exported BOM files.`}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={handleReset}
          disabled={!hasChanges || saveBomDefaultsMutation.isPending}
          className="btn-secondary disabled:opacity-50"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saveBomDefaultsMutation.isPending || selectedColumnIds.length === 0}
          className="btn-primary disabled:bg-gray-400"
        >
          {saveBomDefaultsMutation.isPending ? 'Saving...' : 'Save BOM Defaults'}
        </button>
      </div>
    </div>
  );
};

export default BOMSettings;

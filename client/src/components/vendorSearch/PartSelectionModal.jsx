import { X } from 'lucide-react';

const PartSelectionModal = ({
  appendMode,
  selectedParts,
  libraryPartsForAppend,
  allLibraryParts,
  partSearchTerm,
  onPartSearchTermChange,
  partSortBy,
  onPartSortByChange,
  onSelectPart,
  onClose,
  onAddAsNewPart,
  onFilterParts,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {appendMode === 'distributor' ? 'Select Part to Update Distributors' : 'Select Part to Add Alternative'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {appendMode === 'distributor' ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Multiple parts found with MFG P/N "<strong>{selectedParts[0]?.manufacturerPartNumber}</strong>".
            Select which part to append distributor information to.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              No exact match found for MFG P/N "<strong>{selectedParts[0]?.manufacturerPartNumber}</strong>".
              Select a library part to add this as an alternative part with distributor information.
            </p>

            {/* Search and Sort Controls for Alternative Mode */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Search by part number, manufacturer P/N, or description..."
                value={partSearchTerm}
                onChange={(e) => {
                  const term = e.target.value;
                  onPartSearchTermChange(term);
                  onFilterParts(term, allLibraryParts);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={partSortBy}
                onChange={(e) => onPartSortByChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="part_number">Sort by Part #</option>
                <option value="manufacturer_pn">Sort by MFG P/N</option>
                <option value="category_name">Sort by Category</option>
                <option value="manufacturer_name">Sort by Manufacturer</option>
              </select>
            </div>
          </>
        )}

        {libraryPartsForAppend.length > 0 ? (
          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2">
            {libraryPartsForAppend
              .sort((a, b) => {
                // Sort the parts list
                const aVal = a[partSortBy] || '';
                const bVal = b[partSortBy] || '';
                return aVal.toString().localeCompare(bVal.toString());
              })
              .map((component) => (
              <div
                key={component.is_alternative ? `alt-${component.id}` : component.id}
                onClick={() => onSelectPart(component)}
                className="p-4 border border-gray-200 dark:border-[#3a3a3a] rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {component.is_alternative ? component.parent_part_number : component.part_number}
                      </p>
                      {component.is_alternative && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                          Alternative Part
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {component.manufacturer_name} - {component.manufacturer_pn}
                    </p>
                    {component.is_alternative && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Alternative to: {component.parent_part_number}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {component.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              {appendMode === 'alternative' && partSearchTerm.trim() !== ''
                ? `No parts found matching "${partSearchTerm}". Try a different search term.`
                : 'No parts found in library. Please use "Add to Library" instead.'
              }
            </p>
            <button
              onClick={onAddAsNewPart}
              className="mt-4 btn-primary"
            >
              Add as New Part
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartSelectionModal;

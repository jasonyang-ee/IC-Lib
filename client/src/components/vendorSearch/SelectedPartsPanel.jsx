import { Plus, Download } from 'lucide-react';

const SelectedPartsPanel = ({
  selectedParts,
  searchResults,
  onClearSelection,
  onAddToLibrary,
  onAppendToExisting,
  onDownloadFootprint,
  addToLibraryMutation,
  downloadFootprintMutation,
  canWrite,
}) => {
  if (selectedParts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Actions for Selected Parts
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedParts.length} part{selectedParts.length > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Show selected parts info */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-md">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">Selected:</p>
        <div className="space-y-1">
          {selectedParts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded ${
                searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber)
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
              }`}>
                {searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber) ? 'Digikey' : 'Mouser'}
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-mono">{part.partNumber}</span>
              <span className="text-gray-500 dark:text-gray-500">-</span>
              <span className="text-gray-600 dark:text-gray-400">{part.manufacturerPartNumber}</span>
            </div>
          ))}
        </div>
        {selectedParts.length > 1 && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 italic">
            ℹ️ Primary data will be from {selectedParts.some(p => searchResults?.digikey?.results?.some(dp => dp.partNumber === p.partNumber)) ? 'Digikey' : 'Mouser'}. All selected parts will be added as distributor SKUs.
          </p>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {canWrite && (
          <>
            <button
              onClick={onAddToLibrary}
              disabled={addToLibraryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addToLibraryMutation.isPending ? 'Adding...' : `Add to Library (${selectedParts.length})`}
            </button>
            <button
              onClick={onAppendToExisting}
              disabled={selectedParts.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              title="Append distributor info to existing library part with same MFG P/N"
            >
              <Plus className="w-4 h-4" />
              Append to Existing Parts
            </button>
          </>
        )}
        <button
          onClick={() => onDownloadFootprint('ultra-librarian')}
          disabled={downloadFootprintMutation.isPending || selectedParts.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedParts.length === 0 ? 'Select a part first' : 'Download footprint from Ultra Librarian'}
        >
          <Download className="w-4 h-4" />
          {downloadFootprintMutation.isPending ? 'Downloading...' : 'Ultra Librarian'}
        </button>
        <button
          onClick={() => onDownloadFootprint('snapeda')}
          disabled={downloadFootprintMutation.isPending || selectedParts.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedParts.length === 0 ? 'Select a part first' : 'Download footprint from SnapEDA'}
        >
          <Download className="w-4 h-4" />
          {downloadFootprintMutation.isPending ? 'Downloading...' : 'SnapEDA'}
        </button>
      </div>
      {addToLibraryMutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">
          Part successfully added to library!
        </p>
      )}
      {downloadFootprintMutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">
          Footprint download completed! Check the downloads folder.
        </p>
      )}
      {downloadFootprintMutation.isError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {downloadFootprintMutation.error?.response?.data?.message ||
           downloadFootprintMutation.error?.response?.data?.error ||
           'Failed to download footprint. The API may not be configured.'}
        </p>
      )}
    </div>
  );
};

export default SelectedPartsPanel;

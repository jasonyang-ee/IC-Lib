import { ExternalLink } from 'lucide-react';

const PartCard = ({ part, isSelected, onToggle }) => (
  <div
    onClick={() => onToggle(part)}
    className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
      isSelected
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300'
    }`}
  >
    {/* Checkbox */}
    <div className="absolute top-3 right-3">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}} // Handled by div onClick
        className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
      />
    </div>
    <div className="flex justify-between items-start pr-8">
      <div className="flex-1">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {part.partNumber}
          {part.manufacturerPartNumber && <span className="font-normal text-sm text-gray-500 dark:text-gray-400"> - MFG P/N: {part.manufacturerPartNumber}</span>}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {part.manufacturer && <span className="font-medium">{part.manufacturer}</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{part.description}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          <span className="font-medium">Package:</span> {part.packageType || 'N/A'} |
          <span className="font-medium"> Series:</span> {part.series || '-'} |
          <span className="font-medium"> Category:</span> {part.category || 'N/A'}
        </p>
        <div className="flex gap-4 mt-2 items-center">
          <span className="text-xs text-gray-600 dark:text-gray-400">Stock: {part.stock}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">MOQ: {part.minimumOrderQuantity || 1}</span>
        </div>
        {/* Pricing Tiers */}
        {part.pricing && part.pricing.length > 0 && (
          <div className="mt-2 text-xs">
            <span className="font-medium text-gray-700 dark:text-gray-300">Pricing: </span>
            {part.pricing.map((price, idx) => (
              <span key={idx} className="text-green-600 dark:text-green-400 mr-3">
                {price.quantity}+: ${typeof price.price === 'number' ? price.price.toFixed(4) : price.price}
              </span>
            ))}
          </div>
        )}
      </div>
      {part.productUrl && (
        <a
          href={part.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  </div>
);

const VendorSearchResults = ({
  searchResults,
  selectedParts,
  togglePartSelection,
  isPartSelected,
}) => {
  if (!searchResults) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden mb-6">
      {/* Digikey Results */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-red-50 dark:bg-red-900/20 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Digikey Results</h3>
          {selectedParts.length > 0 && (
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              {selectedParts.filter(p => searchResults.digikey?.results?.some(dp => dp.partNumber === p.partNumber)).length} selected
            </span>
          )}
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
          {searchResults.digikey?.error ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.digikey.error}</p>
          ) : searchResults.digikey?.results?.length > 0 ? (
            searchResults.digikey.results.map((part, index) => (
              <PartCard
                key={index}
                part={part}
                isSelected={isPartSelected(part.partNumber)}
                onToggle={togglePartSelection}
              />
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
          )}
        </div>
      </div>

      {/* Mouser Results */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mouser Results</h3>
          {selectedParts.length > 0 && (
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              {selectedParts.filter(p => searchResults.mouser?.results?.some(mp => mp.partNumber === p.partNumber)).length} selected
            </span>
          )}
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
          {searchResults.mouser?.error ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.mouser.error}</p>
          ) : searchResults.mouser?.results?.length > 0 ? (
            searchResults.mouser.results.map((part, index) => (
              <PartCard
                key={index}
                part={part}
                isSelected={isPartSelected(part.partNumber)}
                onToggle={togglePartSelection}
              />
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorSearchResults;

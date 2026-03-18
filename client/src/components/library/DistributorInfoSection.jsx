import { Search } from 'lucide-react';

/**
 * DistributorInfoSection - Distributor display for the selected alternative/primary in view mode.
 *
 * Shows distributor name, link, SKU (copyable), stock quantity, and price breaks.
 *
 * Props:
 * - selectedComponent: object
 * - selectedAlternative: object
 * - onCopy: (text, label) => void
 * - copiedText: string   currently-copied label (for "Copied!" indicator)
 * - onSearchVendor: () => void   navigate to vendor search
 */
const DistributorInfoSection = ({
  selectedComponent,
  selectedAlternative,
  onCopy,
  copiedText,
  onSearchVendor,
}) => {
  // Sort distributors in the standard order: Digikey, Mouser, Arrow, Newark
  const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];

  const sortedDistributors = selectedAlternative?.distributors
    ? [...selectedAlternative.distributors].sort((a, b) => {
        const indexA = distributorOrder.indexOf(a.distributor_name);
        const indexB = distributorOrder.indexOf(b.distributor_name);
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;
        return orderA - orderB;
      })
    : [];

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-3 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Distributor Information</h3>
        {onSearchVendor && (
          <button
            onClick={onSearchVendor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Search Vendor"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Vendor</span>
          </button>
        )}
      </div>
      {selectedComponent && sortedDistributors.length > 0 ? (
        <div className="space-y-4">
          {sortedDistributors.map((dist, index) => (
            <div key={index} className="border-b border-gray-100 dark:border-[#3a3a3a] pb-2 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{dist.distributor_name}</p>
                {dist.url && (
                  <a
                    href={dist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    Link
                  </a>
                )}
              </div>
              {dist.sku && (
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => onCopy(dist.sku, `sku_${index}`)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                    title="Click to copy SKU"
                  >
                    SKU: {dist.sku}
                  </button>
                  {copiedText === `sku_${index}` && (
                    <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Stock: {dist.stock_quantity || 'N/A'}</p>
              {dist.price_breaks && dist.price_breaks.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Price Breaks:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                    {dist.price_breaks.map((priceBreak, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-[#333333] px-2 py-1 rounded">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{priceBreak.quantity}+:</span>
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">${Number(priceBreak.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No distributor information available</p>
      )}
    </div>
  );
};

export default DistributorInfoSection;

import { Copy } from 'lucide-react';

const VendorDataPanel = ({ editData, isEditMode, onAutoFill, onCopy, copiedText }) => {
  const vendorData = editData._vendorSearchData;
  if (!vendorData) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">
          Vendor API Data ({vendorData.source === 'digikey' ? 'Digikey' : 'Mouser'})
        </h3>
        {isEditMode && (
          <button
            onClick={onAutoFill}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
            title="Auto-fill Manufacturer, MFG P/N, Package, Value, Specifications, and Datasheet"
          >
            Auto Fill
          </button>
        )}
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
        {isEditMode
          ? 'Click any value to copy to clipboard. Use "Auto Fill" to populate basic fields. Specifications must be filled manually.'
          : 'Click any value to copy to clipboard. All data from vendor API.'}
      </p>
      <div className="space-y-3 text-sm">
        {/* Basic Info */}
        <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Basic Information</p>
          <CopyableRow label="MFG Part Number" value={vendorData.manufacturerPartNumber} onCopy={onCopy} />
          <CopyableRow label="Manufacturer" value={vendorData.manufacturer} onCopy={onCopy} />
          <div
            onClick={() => onCopy(vendorData.description, 'Description')}
            className="flex flex-col py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
          >
            <span className="text-blue-700 dark:text-blue-300 font-medium mb-1 text-xs">Description:</span>
            <span className="text-blue-900 dark:text-blue-100 text-xs flex items-start gap-2">
              <span className="flex-1 whitespace-pre-wrap">{vendorData.description}</span>
              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
            </span>
          </div>
          {vendorData.category && vendorData.category !== 'N/A' && (
            <CopyableRow label="Category" value={vendorData.category} onCopy={onCopy} />
          )}
        </div>

        {/* Package & Series */}
        {(vendorData.packageType || vendorData.series) && (
          <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Package Details</p>
            {vendorData.packageType && vendorData.packageType !== 'N/A' && (
              <CopyableRow label="Package/Case" value={vendorData.packageType} onCopy={onCopy} />
            )}
            {vendorData.series && vendorData.series !== '-' && (
              <CopyableRow label="Series" value={vendorData.series} onCopy={onCopy} />
            )}
          </div>
        )}

        {/* Distributor Info */}
        {vendorData.distributor && (
          <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Distributor Information</p>
            <CopyableRow label="Vendor SKU" value={vendorData.distributor.sku} onCopy={onCopy} />
            <div className="flex justify-between items-center py-1 px-2">
              <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Stock Available:</span>
              <span className="text-blue-900 dark:text-blue-100 font-mono text-xs font-semibold">
                {vendorData.distributor.stock?.toLocaleString() || '0'} units
              </span>
            </div>
            <div className="flex justify-between items-center py-1 px-2">
              <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Min Order Qty:</span>
              <span className="text-blue-900 dark:text-blue-100 font-mono text-xs">
                {vendorData.distributor.minimumOrderQuantity || '1'}
              </span>
            </div>
          </div>
        )}

        {/* Specifications */}
        {vendorData.specifications && Object.keys(vendorData.specifications).length > 0 ? (
          <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide flex items-center justify-between">
              <span>Technical Specifications</span>
              <span className="text-blue-600 dark:text-blue-400 font-normal normal-case">
                ({Object.keys(vendorData.specifications).length} specs)
              </span>
            </p>
            <div className="space-y-0.5">
              {Object.entries(vendorData.specifications).map(([key, val], idx) => {
                const displayValue = typeof val === 'object' ? val.value : val;
                const displayUnit = typeof val === 'object' ? val.unit : '';
                const dataTypeLabels = ['String', 'UnitOfMeasure', 'CoupledUnitOfMeasure', 'Integer', 'Boolean', 'Decimal', 'Number', 'Double'];
                const shouldShowUnit = displayUnit && !dataTypeLabels.includes(displayUnit);
                return (
                  <div
                    key={idx}
                    onClick={() => onCopy(`${displayValue}${shouldShowUnit ? ' ' + displayUnit : ''}`, key)}
                    className="flex justify-between items-start py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group transition-colors"
                  >
                    <span className="text-blue-700 dark:text-blue-300 text-xs font-medium shrink-0 mr-2" style={{maxWidth: '45%'}}>
                      {key}:
                    </span>
                    <span className="text-blue-900 dark:text-blue-100 text-xs text-right flex items-start gap-1 flex-1">
                      <span className="flex-1 wrap-break-word">{displayValue}{shouldShowUnit ? ` ${displayUnit}` : ''}</span>
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Technical Specifications</p>
            <p className="text-blue-600 dark:text-blue-400 text-xs italic">No specifications available from vendor API</p>
          </div>
        )}

        {/* Datasheet */}
        {vendorData.datasheet && (
          <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Documentation</p>
            <div className="flex flex-col gap-1">
              <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Datasheet URL:</span>
              <a
                href={vendorData.datasheet}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all font-mono bg-blue-100 dark:bg-blue-900/30 p-2 rounded"
              >
                {vendorData.datasheet}
              </a>
            </div>
          </div>
        )}

        {/* Price Breaks */}
        {vendorData.distributor?.pricing && vendorData.distributor.pricing.length > 0 && (
          <div className="pt-2">
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Price Breaks</p>
            <div className="space-y-1">
              {vendorData.distributor.pricing.map((price, idx) => (
                <div
                  key={idx}
                  onClick={() => onCopy(`${price.quantity}+ @ $${price.price}`, 'Price Break')}
                  className="flex justify-between items-center py-0.5 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                >
                  <span className="text-blue-800 dark:text-blue-200 text-xs font-medium">{price.quantity}+ units:</span>
                  <span className="text-green-700 dark:text-green-400 font-mono text-xs font-semibold flex items-center gap-2">
                    ${typeof price.price === 'number' ? price.price.toFixed(4) : price.price}
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Copy feedback */}
      {copiedText && (
        <div className="mt-3 text-xs text-center text-green-700 dark:text-green-400 font-medium animate-fade-in bg-green-100 dark:bg-green-900/30 py-2 rounded">
          Copied &quot;{copiedText}&quot;
        </div>
      )}
    </div>
  );
};

// Reusable row for copyable vendor data
const CopyableRow = ({ label, value, onCopy }) => (
  <div
    onClick={() => onCopy(value, label)}
    className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
  >
    <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">{label}:</span>
    <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
      {value}
      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  </div>
);

export default VendorDataPanel;

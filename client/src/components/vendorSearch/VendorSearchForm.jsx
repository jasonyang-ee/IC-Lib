import { Search, X, QrCode, Camera } from 'lucide-react';

const VendorSearchForm = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  isSearchPending,
  onClearSearch,
  vendorBarcode,
  onVendorBarcodeChange,
  vendorBarcodeInputRef,
  onVendorBarcodeScan,
  onClearVendorBarcode,
  onStartCameraScanner,
  barcodeDecodeResult,
}) => {
  return (
    <>
      {/* Search Form */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] shrink-0 mb-6">
        <form onSubmit={onSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Enter part number or manufacturer part number..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearchPending}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            {isSearchPending ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Vendor Barcode Scanner */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] shrink-0 mb-6">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          <QrCode className="w-4 h-4 inline mr-1" />
          Scan Vendor Barcode
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={vendorBarcodeInputRef}
              type="text"
              value={vendorBarcode}
              onChange={(e) => onVendorBarcodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onVendorBarcodeScan();
                }
              }}
              placeholder="Scan Digikey or Mouser barcode..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
            <button
              onClick={onVendorBarcodeScan}
              disabled={!vendorBarcode.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
            >
              Decode
            </button>
            <button
              onClick={onClearVendorBarcode}
              className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onStartCameraScanner}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
              title="Scan with camera"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {barcodeDecodeResult && (
            <div className={`mt-2 p-3 rounded-md text-sm ${
              barcodeDecodeResult.error
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-200'
            }`}>
              {barcodeDecodeResult.error ? (
                <p>{barcodeDecodeResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">{barcodeDecodeResult.vendor} Barcode Decoded:</p>
                  {barcodeDecodeResult.manufacturerPN && (
                    <p>MFG P/N: <span className="font-mono">{barcodeDecodeResult.manufacturerPN}</span></p>
                  )}
                  {barcodeDecodeResult.digikeySKU && (
                    <p>Digikey SKU: <span className="font-mono">{barcodeDecodeResult.digikeySKU}</span></p>
                  )}
                  {barcodeDecodeResult.mouserSKU && (
                    <p>Mouser SKU: <span className="font-mono">{barcodeDecodeResult.mouserSKU}</span></p>
                  )}
                  {barcodeDecodeResult.quantity && (
                    <p>Quantity: {barcodeDecodeResult.quantity}</p>
                  )}
                  <p className="text-xs mt-2 opacity-75">Search term updated with MFG P/N</p>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Supports Digikey 2D Data Matrix and Mouser Code 128 barcodes
        </p>
      </div>
    </>
  );
};

export default VendorSearchForm;

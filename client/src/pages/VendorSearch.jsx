import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Download, Plus, ExternalLink, X } from 'lucide-react';

const VendorSearch = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedParts, setSelectedParts] = useState([]); // Changed to array for multi-selection

  // Load cached search results from sessionStorage on mount
  useEffect(() => {
    const cachedResults = sessionStorage.getItem('vendorSearchResults');
    const cachedTerm = sessionStorage.getItem('vendorSearchTerm');
    const cachedSelected = sessionStorage.getItem('vendorSelectedParts');
    
    if (cachedResults) {
      try {
        setSearchResults(JSON.parse(cachedResults));
      } catch (e) {
        console.error('Error parsing cached search results:', e);
      }
    }
    
    if (cachedTerm) {
      setSearchTerm(cachedTerm);
    }
    
    if (cachedSelected) {
      try {
        setSelectedParts(JSON.parse(cachedSelected));
      } catch (e) {
        console.error('Error parsing cached selected parts:', e);
      }
    }
  }, []);

  // Helper to toggle part selection
  const togglePartSelection = (part) => {
    setSelectedParts(prev => {
      const isSelected = prev.some(p => p.partNumber === part.partNumber);
      const newSelection = isSelected
        ? prev.filter(p => p.partNumber !== part.partNumber)
        : [...prev, part];
      sessionStorage.setItem('vendorSelectedParts', JSON.stringify(newSelection));
      return newSelection;
    });
  };

  // Check if part is selected
  const isPartSelected = (partNumber) => {
    return selectedParts.some(p => p.partNumber === partNumber);
  };

  const searchMutation = useMutation({
    mutationFn: (partNumber) => api.searchAllVendors(partNumber),
    onSuccess: (response) => {
      setSearchResults(response.data);
      // Cache results in sessionStorage
      sessionStorage.setItem('vendorSearchResults', JSON.stringify(response.data));
      sessionStorage.setItem('vendorSearchTerm', searchTerm);
    },
  });

  const addToLibraryMutation = useMutation({
    mutationFn: (partData) => api.addVendorPartToLibrary(partData),
    onSuccess: (response) => {
      // Navigate to Library page with vendor data pre-filled
      // Get source from the first distributor (prioritized Digikey if available)
      const source = response.data.vendorData?.distributors?.[0]?.source || 
                     response.data.vendorData?.distributor?.source || 
                     'vendor';
      
      navigate('/library', { 
        state: { 
          vendorData: response.data.vendorData,
          source: source
        } 
      });
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        alert(`This part already exists in the library as ${error.response.data.partNumber}.`);
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Unknown error occurred';
        alert(`Error preparing part data: ${errorMsg}`);
        console.error('Add to library error:', error.response?.data || error);
      }
    }
  });

  const downloadFootprintMutation = useMutation({
    mutationFn: ({ partNumber, source }) => {
      if (source === 'ultra-librarian') {
        return api.downloadUltraLibrarianFootprint({ partNumber });
      } else {
        return api.downloadSnapEDAFootprint({ partNumber });
      }
    },
    onSuccess: (data) => {
      console.log('Footprint download response:', data);
    },
    onError: (error) => {
      console.error('Footprint download error:', error);
    }
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchMutation.mutate(searchTerm);
    }
  };

  const handleAddToLibrary = () => {
    if (selectedParts.length === 0) {
      alert('Please select at least one part from the search results.');
      return;
    }

    // Prioritize Digikey for primary data
    const digikeyPart = selectedParts.find(p => 
      searchResults?.digikey?.results?.some(dp => dp.partNumber === p.partNumber)
    );
    
    // Use Digikey as primary source if available, otherwise use first selected
    const primaryPart = digikeyPart || selectedParts[0];
    const primarySource = digikeyPart ? 'digikey' : 'mouser';
    
    // Collect all distributor info from selected parts
    const distributorData = selectedParts.map(part => {
      const isDigikey = searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber);
      return {
        source: isDigikey ? 'digikey' : 'mouser',
        sku: part.partNumber,
        pricing: part.pricing,
        stock: part.stock,
        productUrl: part.productUrl,
        minimumOrderQuantity: part.minimumOrderQuantity
      };
    });
    
    addToLibraryMutation.mutate({
      partNumber: primaryPart.partNumber,
      manufacturerPartNumber: primaryPart.manufacturerPartNumber,
      manufacturer: primaryPart.manufacturer,
      description: primaryPart.description,
      datasheet: primaryPart.datasheet,
      packageType: primaryPart.packageType,
      series: primaryPart.series,
      category: primaryPart.category,
      specifications: primaryPart.specifications || {},
      source: primarySource,
      pricing: primaryPart.pricing,
      stock: primaryPart.stock,
      productUrl: primaryPart.productUrl,
      minimumOrderQuantity: primaryPart.minimumOrderQuantity,
      allDistributors: distributorData // Pass all selected distributors
    });
  };

  const handleDownloadFootprint = (source) => {
    if (selectedParts.length > 0) {
      // Use first selected part for footprint download
      const part = selectedParts[0];
      downloadFootprintMutation.mutate({
        partNumber: part.manufacturerPartNumber,
        source,
      });
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setSelectedParts([]);
    // Clear sessionStorage
    sessionStorage.removeItem('vendorSearchResults');
    sessionStorage.removeItem('vendorSearchTerm');
    sessionStorage.removeItem('vendorSelectedParts');
  };

  return (
    <div className="space-y-6">

      {/* Search Form */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Enter part number or manufacturer part number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            {searchMutation.isPending ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Digikey Results */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Digikey Results</h3>
              {selectedParts.length > 0 && (
                <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                  {selectedParts.filter(p => searchResults.digikey?.results?.some(dp => dp.partNumber === p.partNumber)).length} selected
                </span>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
              {searchResults.digikey?.error ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.digikey.error}</p>
              ) : searchResults.digikey?.results?.length > 0 ? (
                searchResults.digikey.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => togglePartSelection(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
                      isPartSelected(part.partNumber)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-3 right-3">
                      <input
                        type="checkbox"
                        checked={isPartSelected(part.partNumber)}
                        onChange={() => {}} // Handled by div onClick
                        className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-start pr-8">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{part.partNumber}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">MFG P/N: {part.manufacturerPartNumber}</p>
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
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
              )}
            </div>
          </div>

          {/* Mouser Results */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mouser Results</h3>
              {selectedParts.length > 0 && (
                <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                  {selectedParts.filter(p => searchResults.mouser?.results?.some(mp => mp.partNumber === p.partNumber)).length} selected
                </span>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
              {searchResults.mouser?.error ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.mouser.error}</p>
              ) : searchResults.mouser?.results?.length > 0 ? (
                searchResults.mouser.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => togglePartSelection(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
                      isPartSelected(part.partNumber)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-3 right-3">
                      <input
                        type="checkbox"
                        checked={isPartSelected(part.partNumber)}
                        onChange={() => {}} // Handled by div onClick
                        className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-start pr-8">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{part.partNumber}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">MFG P/N: {part.manufacturerPartNumber}</p>
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
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Parts Actions */}
      {selectedParts.length > 0 && (
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Actions for Selected Parts
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedParts.length} part{selectedParts.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => {
                  setSelectedParts([]);
                  sessionStorage.removeItem('vendorSelectedParts');
                }}
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

          <div className="flex gap-3">
            <button 
              onClick={handleAddToLibrary}
              disabled={addToLibraryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addToLibraryMutation.isPending ? 'Adding...' : `Add to Library (${selectedParts.length})`}
            </button>
            <button
              onClick={() => handleDownloadFootprint('ultra-librarian')}
              disabled={downloadFootprintMutation.isPending || selectedParts.length === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedParts.length === 0 ? 'Select a part first' : 'Download footprint from Ultra Librarian'}
            >
              <Download className="w-4 h-4" />
              {downloadFootprintMutation.isPending ? 'Downloading...' : 'Ultra Librarian'}
            </button>
            <button
              onClick={() => handleDownloadFootprint('snapeda')}
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
      )}
    </div>
  );
};

export default VendorSearch;

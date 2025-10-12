import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Download, Plus, ExternalLink } from 'lucide-react';

const VendorSearch = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const searchMutation = useMutation({
    mutationFn: (partNumber) => api.searchAllVendors(partNumber),
    onSuccess: (response) => {
      setSearchResults(response.data);
    },
  });

  const addToLibraryMutation = useMutation({
    mutationFn: (partData) => api.addVendorPartToLibrary(partData),
    onSuccess: (response) => {
      // Navigate to Library page with vendor data pre-filled
      navigate('/library', { 
        state: { 
          vendorData: response.data.vendorData,
          source: selectedPart.source || 'vendor'
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
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchMutation.mutate(searchTerm);
    }
  };

  const handleAddToLibrary = () => {
    if (selectedPart) {
      // Determine source from search results
      const source = searchResults?.digikey?.results?.find(p => p.partNumber === selectedPart.partNumber) 
        ? 'digikey' 
        : 'mouser';
      
      addToLibraryMutation.mutate({
        partNumber: selectedPart.partNumber,
        manufacturerPartNumber: selectedPart.manufacturerPartNumber,
        manufacturer: selectedPart.manufacturer,
        description: selectedPart.description,
        datasheet: selectedPart.datasheet,
        packageType: selectedPart.packageType,
        series: selectedPart.series,
        category: selectedPart.category,
        specifications: selectedPart.specifications || {},
        source,
        pricing: selectedPart.pricing,
        stock: selectedPart.stock,
        productUrl: selectedPart.productUrl,
        minimumOrderQuantity: selectedPart.minimumOrderQuantity
      });
    }
  };

  const handleDownloadFootprint = (source) => {
    if (selectedPart) {
      downloadFootprintMutation.mutate({
        partNumber: selectedPart.manufacturerPartNumber,
        source,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Online Vendor Search</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Search Digikey and Mouser for component information</p>
      </div>

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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            />
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
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Digikey Results</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {searchResults.digikey?.error ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.digikey.error}</p>
              ) : searchResults.digikey?.results?.length > 0 ? (
                searchResults.digikey.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedPart(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPart?.partNumber === part.partNumber
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
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
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mouser Results</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {searchResults.mouser?.error ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{searchResults.mouser.error}</p>
              ) : searchResults.mouser?.results?.length > 0 ? (
                searchResults.mouser.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedPart(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPart?.partNumber === part.partNumber
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
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

      {/* Selected Part Actions */}
      {selectedPart && (
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Actions for Selected Part</h3>
          <div className="flex gap-3">
            <button 
              onClick={handleAddToLibrary}
              disabled={addToLibraryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addToLibraryMutation.isPending ? 'Adding...' : 'Add to Library'}
            </button>
            <button
              onClick={() => handleDownloadFootprint('ultra-librarian')}
              disabled={downloadFootprintMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Ultra Librarian
            </button>
            <button
              onClick={() => handleDownloadFootprint('snapeda')}
              disabled={downloadFootprintMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              SnapEDA
            </button>
          </div>
          {addToLibraryMutation.isSuccess && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              Part successfully added to library!
            </p>
          )}
          {downloadFootprintMutation.isSuccess && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              Footprint download initiated
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorSearch;

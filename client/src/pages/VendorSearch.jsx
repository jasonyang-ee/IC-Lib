import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Download, Plus, ExternalLink } from 'lucide-react';

const VendorSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);

  const searchMutation = useMutation({
    mutationFn: (partNumber) => api.searchAllVendors(partNumber),
    onSuccess: (response) => {
      setSearchResults(response.data);
    },
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
        <h1 className="text-3xl font-bold text-gray-900">Online Vendor Search</h1>
        <p className="text-gray-600 mt-1">Search Digikey and Mouser for component information</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Enter part number or manufacturer part number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="btn-primary px-8"
          >
            {searchMutation.isPending ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Digikey Results */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-red-50">
              <h3 className="text-lg font-semibold text-gray-900">Digikey Results</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {searchResults.digikey?.error ? (
                <p className="text-sm text-gray-500">{searchResults.digikey.error}</p>
              ) : searchResults.digikey?.results?.length > 0 ? (
                searchResults.digikey.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedPart(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPart?.partNumber === part.partNumber
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{part.partNumber}</p>
                        <p className="text-sm text-gray-600 mt-1">{part.manufacturerPartNumber}</p>
                        <p className="text-xs text-gray-500 mt-1">{part.description}</p>
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs text-gray-600">Stock: {part.stock}</span>
                          {part.pricing && part.pricing[0] && (
                            <span className="text-xs text-green-600 font-medium">
                              ${part.pricing[0].price}
                            </span>
                          )}
                        </div>
                      </div>
                      {part.productUrl && (
                        <a
                          href={part.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No results found</p>
              )}
            </div>
          </div>

          {/* Mouser Results */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-semibold text-gray-900">Mouser Results</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {searchResults.mouser?.error ? (
                <p className="text-sm text-gray-500">{searchResults.mouser.error}</p>
              ) : searchResults.mouser?.results?.length > 0 ? (
                searchResults.mouser.results.map((part, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedPart(part)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPart?.partNumber === part.partNumber
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{part.partNumber}</p>
                        <p className="text-sm text-gray-600 mt-1">{part.manufacturerPartNumber}</p>
                        <p className="text-xs text-gray-500 mt-1">{part.description}</p>
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs text-gray-600">Stock: {part.stock}</span>
                          {part.pricing && part.pricing[0] && (
                            <span className="text-xs text-green-600 font-medium">
                              ${part.pricing[0].price}
                            </span>
                          )}
                        </div>
                      </div>
                      {part.productUrl && (
                        <a
                          href={part.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No results found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Part Actions */}
      {selectedPart && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions for Selected Part</h3>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add to Library
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
          {downloadFootprintMutation.isSuccess && (
            <p className="mt-3 text-sm text-green-600">
              Footprint download initiated
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorSearch;

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { VendorSearchForm, VendorSearchResults, SelectedPartsPanel, PartSelectionModal } from '../components/vendorSearch';

const VendorSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess } = useNotification();
  const { canWrite } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedParts, setSelectedParts] = useState([]); // Changed to array for multi-selection
  const [showPartSelectionModal, setShowPartSelectionModal] = useState(false);
  const [libraryPartsForAppend, setLibraryPartsForAppend] = useState([]);
  const [_selectedLibraryPart, setSelectedLibraryPart] = useState(null);
  const [appendMode, setAppendMode] = useState(''); // 'distributor' or 'alternative'
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [allLibraryParts, setAllLibraryParts] = useState([]);
  const [partSortBy, setPartSortBy] = useState('part_number'); // Sort field for parts list

  // Fetch distributors and manufacturers for appending
  const { data: distributors } = useQuery({
    queryKey: ['distributors'],
    queryFn: async () => {
      const response = await api.getDistributors();
      return response.data;
    },
  });

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers();
      return response.data;
    },
  });

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

  // Handle incoming search term from Inventory page or Library page
  useEffect(() => {
    if (location.state?.searchFromInventory) {
      const partNumber = location.state.searchFromInventory;
      setSearchTerm(partNumber);
      // Clear any existing selections
      setSelectedParts([]);
      setSearchResults(null);
      sessionStorage.removeItem('vendorSearchResults');
      sessionStorage.removeItem('vendorSearchTerm');
      sessionStorage.removeItem('vendorSelectedParts');
      // Automatically trigger search
      searchMutation.mutate(partNumber);
      // Clear the state to prevent re-searching on subsequent renders
      window.history.replaceState({}, document.title);
    } else if (location.state?.searchFromLibrary) {
      const partNumber = location.state.searchFromLibrary;
      setSearchTerm(partNumber);
      // Clear any existing selections
      setSelectedParts([]);
      setSearchResults(null);
      sessionStorage.removeItem('vendorSearchResults');
      sessionStorage.removeItem('vendorSearchTerm');
      sessionStorage.removeItem('vendorSelectedParts');
      // Automatically trigger search
      searchMutation.mutate(partNumber);
      // Clear the state to prevent re-searching on subsequent renders
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

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

  const normalizeLookupValue = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  const getDistributorId = (source) => {
    const normalizedSource = normalizeLookupValue(source);
    return distributors?.find(d => normalizeLookupValue(d.name).includes(normalizedSource))?.id || null;
  };

  const getManufacturerRecord = (manufacturerName) => {
    const normalizedManufacturer = normalizeLookupValue(manufacturerName);

    if (!normalizedManufacturer) {
      return null;
    }

    return manufacturers?.find(m => normalizeLookupValue(m.name) === normalizedManufacturer) || null;
  };

  // Vendor barcode decode result from the scan panel (shared decoder): put the
  // decoded MPN/SKU in the search box and auto-trigger the vendor search. Raw
  // ECIA payloads and parse errors never reach the search box.
  const handleBarcodeDecode = (decoded) => {
    if (decoded.error || !decoded.searchTerm) return;
    setSearchTerm(decoded.searchTerm);
    searchMutation.mutate(decoded.searchTerm);
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
    onSuccess: () => {
    },
    onError: (error) => {
      console.error('Footprint download error:', error);
    }
  });

  const handleSearch = (e) => {
	setSelectedParts([]);
    e.preventDefault();
    if (searchTerm.trim()) {
      searchMutation.mutate(searchTerm);
    }
  };

  const handleAppendToExisting = async () => {
    if (selectedParts.length === 0) {
      alert('Please select at least one part from the search results.');
      return;
    }

    // Get the manufacturer part number from the first selected part
    const primaryPart = selectedParts[0];
    const mfgPN = primaryPart.manufacturerPartNumber;

    try {
      // Search library for parts with same MFG part number
      const response = await api.getComponents({ search: mfgPN });
      const components = response.data;

      // Filter to exact match on manufacturer_pn
      const exactMatches = components.filter(c => 
        c.manufacturer_pn?.toLowerCase() === mfgPN.toLowerCase()
      );

      // Also search for alternatives with matching manufacturer_pn
      let alternativeMatches = [];
      for (const component of components) {
        try {
          const altResponse = await api.getComponentAlternatives(component.id);
          const alternatives = altResponse.data || [];
          
          // Find alternatives with matching manufacturer_pn
          const matchingAlts = alternatives.filter(alt => 
            alt.manufacturer_pn?.toLowerCase() === mfgPN.toLowerCase()
          );
          
          // Store alternative with its parent component info
          matchingAlts.forEach(alt => {
            alternativeMatches.push({
              ...alt,
              parent_component_id: component.id,
              parent_part_number: component.part_number,
              category_name: component.category_name,
              approval_status: component.approval_status,
              is_alternative: true
            });
          });
        } catch {
          // Ignore errors from individual alternative fetches
        }
      }

      if (exactMatches.length === 1 && alternativeMatches.length === 0) {
        // Exact match found on primary component - append distributors directly
        setSelectedLibraryPart(exactMatches[0]);
        setAppendMode('distributor');
        await appendDistributorsToComponent(exactMatches[0]);
      } else if (exactMatches.length === 0 && alternativeMatches.length === 1) {
        // Exact match found on alternative only - append to alternative
        await appendDistributorsToAlternative(alternativeMatches[0]);
      } else if (exactMatches.length > 0 || alternativeMatches.length > 0) {
        // Multiple matches (could be mix of primary and alternative) - show selection modal
        const combinedMatches = [
          ...exactMatches.map(c => ({ ...c, is_alternative: false })),
          ...alternativeMatches
        ];
        setLibraryPartsForAppend(combinedMatches);
        setAppendMode('distributor');
        setShowPartSelectionModal(true);
      } else {
        // No exact match - load ALL library parts for user to search and select
        const allPartsResponse = await api.getComponents({});
        const allParts = allPartsResponse.data;
        setAllLibraryParts(allParts);
        
        // Check if there's a cached part number from Library page
        const cachedPartNumber = sessionStorage.getItem('libraryPartNumberForAlternative');
        let initialSearchTerm = '';
        let filteredParts = allParts;
        
        if (cachedPartNumber) {
          initialSearchTerm = cachedPartNumber;
          // Filter parts based on cached part number
          filteredParts = allParts.filter(part => 
            part.part_number?.toLowerCase().includes(cachedPartNumber.toLowerCase()) ||
            part.manufacturer_pn?.toLowerCase().includes(cachedPartNumber.toLowerCase()) ||
            part.description?.toLowerCase().includes(cachedPartNumber.toLowerCase()) ||
            part.manufacturer_name?.toLowerCase().includes(cachedPartNumber.toLowerCase())
          );
          // Clear the cache after using it
          sessionStorage.removeItem('libraryPartNumberForAlternative');
        }
        
        setPartSearchTerm(initialSearchTerm);
        setLibraryPartsForAppend(filteredParts);
        setAppendMode('alternative');
        setShowPartSelectionModal(true);
      }
    } catch (error) {
      console.error('Error searching library:', error);
      alert('Error searching library: ' + error.message);
    }
  };

  const appendDistributorsToAlternative = async (alternative) => {
    try {
      // Get existing distributors for this alternative
      const existingDist = await api.getComponentAlternatives(alternative.parent_component_id);
      const allAlternatives = existingDist.data || [];
      const thisAlt = allAlternatives.find(a => a.id === alternative.id);
      const existingDistributors = thisAlt?.distributors || [];

      // Collect new distributor data from selected parts
      const newDistributors = selectedParts.map(part => {
        const isDigikey = searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber);
        const source = isDigikey ? 'digikey' : 'mouser';
        const distributorName = isDigikey ? 'Digikey' : 'Mouser';
        
        return {
          distributor_id: getDistributorId(source),
          distributor_name: distributorName,
          sku: part.partNumber,
          url: part.productUrl || '',
          in_stock: (part.stock || 0) > 0,
          stock_quantity: part.stock || 0,
          minimum_order_quantity: part.minimumOrderQuantity || 1,
          price_breaks: part.pricing || []
        };
      });

      // Merge with existing distributors (avoid duplicates by SKU)
      const mergedDistributors = [...existingDistributors];
      newDistributors.forEach(newDist => {
        const existingIndex = mergedDistributors.findIndex(d => d.sku === newDist.sku);
        if (existingIndex >= 0) {
          // Update existing
          mergedDistributors[existingIndex] = { 
            ...mergedDistributors[existingIndex], 
            ...newDist,
            id: mergedDistributors[existingIndex].id // Preserve existing ID
          };
        } else {
          // Add new
          mergedDistributors.push(newDist);
        }
      });

      // Update alternative with new distributors
      await api.updateComponentAlternative(alternative.parent_component_id, alternative.id, {
        manufacturer_id: alternative.manufacturer_id,
        manufacturer_pn: alternative.manufacturer_pn,
        distributors: mergedDistributors
      });

      // Show success notification
      showSuccess(`Successfully appended ${newDistributors.length} distributor(s) to alternative ${alternative.manufacturer_pn} of ${alternative.parent_part_number}`);
      
      // Clear selection
      setSelectedParts([]);
      sessionStorage.removeItem('vendorSelectedParts');
      
      // Navigate to Library page with the parent component's part number
      navigate('/library', { state: { searchTerm: alternative.parent_part_number, refreshAlternatives: true } });
    } catch (error) {
      console.error('Error appending distributors to alternative:', error);
      console.error('Error details:', error.response?.data);
      alert('Error appending distributors to alternative: ' + (error.response?.data?.error || error.message));
    }
  };

  const appendDistributorsToComponent = async (component) => {
    try {
      // Get existing distributors
      const existingDist = await api.getComponentDistributors(component.id);
      const existingDistributors = existingDist.data || [];

      // Collect new distributor data from selected parts
      const newDistributors = selectedParts.map(part => {
        const isDigikey = searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber);
        const source = isDigikey ? 'digikey' : 'mouser';
        const distributorName = isDigikey ? 'Digikey' : 'Mouser';
        
        return {
          distributor_id: getDistributorId(source),
          distributor_name: distributorName,
          sku: part.partNumber,
          url: part.productUrl || '',
          in_stock: (part.stock || 0) > 0,
          stock_quantity: part.stock || 0,
          minimum_order_quantity: part.minimumOrderQuantity || 1,
          price_breaks: part.pricing || []
        };
      });

      // Merge with existing distributors (avoid duplicates by SKU)
      const mergedDistributors = [...existingDistributors];
      newDistributors.forEach(newDist => {
        const existingIndex = mergedDistributors.findIndex(d => d.sku === newDist.sku);
        if (existingIndex >= 0) {
          // Update existing - keep the id if it exists
          mergedDistributors[existingIndex] = { 
            ...mergedDistributors[existingIndex], 
            ...newDist,
            id: mergedDistributors[existingIndex].id // Preserve existing ID
          };
        } else {
          // Add new
          mergedDistributors.push(newDist);
        }
      });

      // Update distributors - wrap in object as backend expects { distributors: [...] }
      await api.updateComponentDistributors(component.id, { distributors: mergedDistributors });

      // Show success notification
      showSuccess(`Successfully appended ${newDistributors.length} distributor(s) to ${component.part_number}`);
      
      // Clear selection
      setSelectedParts([]);
      sessionStorage.removeItem('vendorSelectedParts');
      
      // Navigate to Library page with the component's part number
      navigate('/library', { state: { searchTerm: component.part_number, refreshDistributors: true } });
    } catch (error) {
      console.error('Error appending distributors:', error);
      console.error('Error details:', error.response?.data);
      alert('Error appending distributors: ' + (error.response?.data?.error || error.message));
    }
  };

  const appendAsAlternative = async (component) => {
    try {
      const primaryPart = selectedParts[0];
      const manufacturerRecord = getManufacturerRecord(primaryPart.manufacturer);
      
      // Collect distributor data
      const distributorData = selectedParts.map(part => {
        const isDigikey = searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber);
        const source = isDigikey ? 'digikey' : 'mouser';
        
        return {
          distributor_id: getDistributorId(source),
          sku: part.partNumber,
          url: part.productUrl || '',
          in_stock: (part.stock || 0) > 0,
          stock_quantity: part.stock || 0,
          minimum_order_quantity: part.minimumOrderQuantity || 1,
          price_breaks: part.pricing || []
        };
      });

      // Create alternative part
      const alternativeData = {
        manufacturer_id: manufacturerRecord?.id || null,
        manufacturer_name: primaryPart.manufacturer || null,
        manufacturer_pn: primaryPart.manufacturerPartNumber,
        datasheet_url: primaryPart.datasheet || '',
        notes: `Added from vendor search`,
        distributors: distributorData
      };

      await api.createComponentAlternative(component.id, alternativeData);

      // Show success notification
      showSuccess(`Successfully added ${primaryPart.manufacturerPartNumber} as alternative to ${component.part_number}`);
      
      // Clear selection
      setSelectedParts([]);
      sessionStorage.removeItem('vendorSelectedParts');
      
      // Navigate to Library page with the component's part number
      navigate('/library', { state: { searchTerm: component.part_number, refreshAlternatives: true } });
    } catch (error) {
      console.error('Error adding alternative:', error);
      alert('Error adding alternative: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSelectPartForAppend = async (component) => {
    setShowPartSelectionModal(false);
    
    if (appendMode === 'distributor') {
      // Check if it's an alternative part or a regular component
      if (component.is_alternative) {
        await appendDistributorsToAlternative(component);
      } else {
        await appendDistributorsToComponent(component);
      }
    } else if (appendMode === 'alternative') {
      await appendAsAlternative(component);
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
	document.querySelector('input[type="text"]')?.focus();
    // Clear sessionStorage
    sessionStorage.removeItem('vendorSearchResults');
    sessionStorage.removeItem('vendorSearchTerm');
    sessionStorage.removeItem('vendorSelectedParts');
  };

  const handleClearSelection = () => {
    setSelectedParts([]);
    sessionStorage.removeItem('vendorSelectedParts');
  };

  const handleClosePartSelectionModal = () => {
    setShowPartSelectionModal(false);
    setLibraryPartsForAppend([]);
    setAllLibraryParts([]);
    setPartSearchTerm('');
    setPartSortBy('part_number');
    setAppendMode('');
  };

  const handleAddAsNewPart = () => {
    handleClosePartSelectionModal();
    handleAddToLibrary();
  };

  const handleFilterParts = (term, allParts) => {
    if (term.trim() === '') {
      setLibraryPartsForAppend(allParts);
    } else {
      const filtered = allParts.filter(part =>
        part.part_number?.toLowerCase().includes(term.toLowerCase()) ||
        part.manufacturer_pn?.toLowerCase().includes(term.toLowerCase()) ||
        part.description?.toLowerCase().includes(term.toLowerCase()) ||
        part.manufacturer_name?.toLowerCase().includes(term.toLowerCase())
      );
      setLibraryPartsForAppend(filtered);
    }
  };

  return (
    <div className="h-full flex flex-col">

      <VendorSearchForm
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearch}
        isSearchPending={searchMutation.isPending}
        onClearSearch={handleClearSearch}
        onBarcodeDecode={handleBarcodeDecode}
      />

      <VendorSearchResults
        searchResults={searchResults}
        selectedParts={selectedParts}
        togglePartSelection={togglePartSelection}
        isPartSelected={isPartSelected}
      />

      <SelectedPartsPanel
        selectedParts={selectedParts}
        searchResults={searchResults}
        onClearSelection={handleClearSelection}
        onAddToLibrary={handleAddToLibrary}
        onAppendToExisting={handleAppendToExisting}
        onDownloadFootprint={handleDownloadFootprint}
        addToLibraryMutation={addToLibraryMutation}
        downloadFootprintMutation={downloadFootprintMutation}
        canWrite={canWrite()}
      />

      {/* Part Selection Modal */}
      {showPartSelectionModal && (
        <PartSelectionModal
          appendMode={appendMode}
          selectedParts={selectedParts}
          libraryPartsForAppend={libraryPartsForAppend}
          allLibraryParts={allLibraryParts}
          partSearchTerm={partSearchTerm}
          onPartSearchTermChange={setPartSearchTerm}
          partSortBy={partSortBy}
          onPartSortByChange={setPartSortBy}
          onSelectPart={handleSelectPartForAppend}
          onClose={handleClosePartSelectionModal}
          onAddAsNewPart={handleAddAsNewPart}
          onFilterParts={handleFilterParts}
        />
      )}
    </div>
  );
};

export default VendorSearch;

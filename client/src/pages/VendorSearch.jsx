import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { Search, Download, Plus, ExternalLink, X, QrCode, Camera } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const VendorSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedParts, setSelectedParts] = useState([]); // Changed to array for multi-selection
  const [vendorBarcode, setVendorBarcode] = useState('');
  const [barcodeDecodeResult, setBarcodeDecodeResult] = useState(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const scannerRef = useRef(null);
  const vendorBarcodeInputRef = useRef(null);
  const [showPartSelectionModal, setShowPartSelectionModal] = useState(false);
  const [libraryPartsForAppend, setLibraryPartsForAppend] = useState([]);
  const [selectedLibraryPart, setSelectedLibraryPart] = useState(null);
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

  // Digikey barcode decoder
  const decodeVendorBarcode = (barcode) => {
    // Reset result
    setBarcodeDecodeResult(null);

    if (!barcode || barcode.trim() === '') {
      return;
    }

    console.log('Raw barcode input:', barcode);

    // Define control characters
    const GS = String.fromCharCode(29); // Group Separator
    const RS = String.fromCharCode(30); // Record Separator
    const EOT = String.fromCharCode(4); // End of Transmission
    
    // Replace literal text representations with actual control characters
    let cleanBarcode = barcode
      .replace(/\{GS\}/g, GS)
      .replace(/\{RS\}/g, RS)
      .replace(/\{EOT\}/g, EOT);
    
    // Also handle escaped representations
    cleanBarcode = cleanBarcode
      .replace(/\\x1d/g, GS)
      .replace(/\\x1e/g, RS)
      .replace(/\\x04/g, EOT);
    
    // Split by GS (Group Separator) to get fields
    const fields = cleanBarcode.split(GS);
    
    // DigiKey format after header: [)>RS06GS <field1> GS <field2> GS ...
    let mfgPartNumber = null;
    let digikeySkus = [];
    let quantity = null;
    
    // Parse fields
    fields.forEach((field, index) => {
      // Remove any leading/trailing control characters and whitespace
      field = field.trim();
      
      // Remove header if present in first field
      if (index === 0) {
        field = field.replace(/^\[\)>[\x1e]*06/, '');
        field = field.replace(/^[\x1e\x1d]+/, '');
      }
      
      // Remove trailing control characters
      field = field.replace(/[\x1e\x04]+$/, '');
      
      if (!field) return;
      
      // Check for manufacturer part number (1P prefix)
      if (field.startsWith('1P')) {
        mfgPartNumber = field.substring(2);
      }
      // Check for DigiKey SKU (30P prefix)
      else if (field.startsWith('30P')) {
        const sku = field.substring(3);
        digikeySkus.push(sku);
      }
      // Check for alternative SKU format (P prefix without 30)
      else if (field.startsWith('P') && field.length > 1) {
        const sku = field.substring(1);
        if (!digikeySkus.includes(sku)) {
          digikeySkus.push(sku);
        }
      }
      // Check for quantity (Q prefix)
      else if (field.startsWith('Q') && field.length > 1) {
        const qtyStr = field.substring(1).match(/\d+/);
        if (qtyStr) {
          quantity = parseInt(qtyStr[0], 10);
        }
      }
      // If no prefix and we haven't found MFG P/N yet, and it looks like a valid part number
      else if (!mfgPartNumber && field.match(/^[A-Z0-9][A-Z0-9\-+_.]+$/i)) {
        mfgPartNumber = field;
      }
    });

    // If we successfully parsed the barcode
    if (mfgPartNumber) {
      const result = {
        vendor: 'Digikey',
        manufacturerPN: mfgPartNumber,
        quantity: quantity,
        digikeySKU: digikeySkus[0] || null
      };
      
      setBarcodeDecodeResult(result);
      
      // Set the search term to the manufacturer part number
      setSearchTerm(mfgPartNumber);
      
      // Auto-trigger search
      searchMutation.mutate(mfgPartNumber);
      
      // Auto-focus the input field for next scan
      setTimeout(() => {
        if (vendorBarcodeInputRef.current) {
          vendorBarcodeInputRef.current.focus();
          vendorBarcodeInputRef.current.select();
        }
      }, 100);
      
      return;
    }

    // If no pattern matched
    setBarcodeDecodeResult({
      error: 'Could not parse manufacturer part number from barcode. Please check the format.'
    });
  };

  // Auto-decode barcode with debounce
  useEffect(() => {
    if (vendorBarcode && vendorBarcode.length > 10) {
      const timer = setTimeout(() => {
        decodeVendorBarcode(vendorBarcode);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [vendorBarcode]);

  const handleVendorBarcodeScan = () => {
    decodeVendorBarcode(vendorBarcode);
    if (vendorBarcodeInputRef.current) {
      vendorBarcodeInputRef.current.focus();
      vendorBarcodeInputRef.current.select();
    }
  };

  const handleClearVendorBarcode = () => {
    setVendorBarcode('');
    setBarcodeDecodeResult(null);
    setTimeout(() => {
      if (vendorBarcodeInputRef.current) {
        vendorBarcodeInputRef.current.focus();
        vendorBarcodeInputRef.current.select();
      }
    }, 0);
  };

  // Camera QR Scanner functions
  const startCameraScanner = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameraDevices(devices);
        const rearCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        setSelectedCamera(rearCamera ? rearCamera.id : devices[0].id);
        setShowCameraScanner(true);
      } else {
        alert('No cameras found on your device.');
      }
    } catch (error) {
      console.error('Error getting cameras:', error);
      alert('Failed to access camera. Please check permissions.');
    }
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setShowCameraScanner(false);
      }).catch(err => {
        console.error('Error stopping scanner:', err);
        setShowCameraScanner(false);
      });
    } else {
      setShowCameraScanner(false);
    }
  };

  const handleCameraScan = (decodedText) => {
    stopCameraScanner();
    setSearchTerm(decodedText);
    
    // Try to decode it if it looks like a vendor barcode
    if (decodedText.length > 20 && (decodedText.includes(String.fromCharCode(29)) || decodedText.includes('[)>'))) {
      decodeVendorBarcode(decodedText);
    }
  };

  // Start camera when modal opens
  useEffect(() => {
    if (showCameraScanner && selectedCamera && !scannerRef.current) {
      const scanner = new Html5Qrcode('vendor-qr-reader');
      scannerRef.current = scanner;
      
      scanner.start(
        selectedCamera,
        {
          fps: 30,
          qrbox: {width: 300, height: 300},
          aspectRatio: 1,
          formatsToSupport: [ Html5QrcodeSupportedFormats.DATA_MATRIX ]
        },
        handleCameraScan,
        (errorMessage) => {
          // Ignore errors, they're just "no QR code found" messages
        }
      ).catch(err => {
        console.error('Error starting scanner:', err);
        alert('Failed to start camera scanner.');
        setShowCameraScanner(false);
      });
    }
    
    return () => {
      if (scannerRef.current && showCameraScanner) {
        scannerRef.current.stop().catch(err => console.error('Cleanup error:', err));
      }
    };
  }, [showCameraScanner, selectedCamera]);

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
              is_alternative: true
            });
          });
        } catch (error) {
          // Ignore errors from individual alternative fetches
          console.log(`No alternatives for ${component.part_number}`);
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
        
        // Find distributor ID from the list
        const distId = distributors?.find(d => d.name.toLowerCase() === source)?.id;
        
        return {
          distributor_id: distId || '',
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
        
        // Find distributor ID from the list
        const distId = distributors?.find(d => d.name.toLowerCase() === source)?.id;
        
        return {
          distributor_id: distId || '',
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
      console.error('Merged distributors data:', mergedDistributors);
      alert('Error appending distributors: ' + (error.response?.data?.error || error.message));
    }
  };

  const appendAsAlternative = async (component) => {
    try {
      const primaryPart = selectedParts[0];
      
      // Collect distributor data
      const distributorData = selectedParts.map(part => {
        const isDigikey = searchResults?.digikey?.results?.some(dp => dp.partNumber === part.partNumber);
        const source = isDigikey ? 'digikey' : 'mouser';
        const distId = distributors?.find(d => d.name.toLowerCase() === source)?.id;
        
        return {
          distributor_id: distId || '',
          sku: part.partNumber,
          url: part.productUrl || '',
          in_stock: (part.stock || 0) > 0,
          stock_quantity: part.stock || 0,
          minimum_order_quantity: part.minimumOrderQuantity || 1,
          price_breaks: part.pricing || []
        };
      });

      // Find manufacturer ID
      const mfgId = manufacturers?.find(m => 
        m.name.toLowerCase() === primaryPart.manufacturer.toLowerCase()
      )?.id;

      // Create alternative part
      const alternativeData = {
        manufacturer_id: mfgId || '',
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
      alert('Error adding alternative: ' + error.message);
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

      {/* Vendor Barcode Scanner */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
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
              onChange={(e) => setVendorBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleVendorBarcodeScan();
                }
              }}
              placeholder="Scan Digikey or Mouser barcode..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
            <button
              onClick={handleVendorBarcodeScan}
              disabled={!vendorBarcode.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
            >
              Decode
            </button>
            <button
              onClick={handleClearVendorBarcode}
              className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
            >
              Clear
            </button>
            <button
              onClick={startCameraScanner}
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {part.manufacturer && <span className="font-medium">{part.manufacturer}</span>}
                          {part.manufacturer && ' - '}
                          <span>MFG P/N: {part.manufacturerPartNumber}</span>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {part.manufacturer && <span className="font-medium">{part.manufacturer}</span>}
                          {part.manufacturer && ' - '}
                          <span>MFG P/N: {part.manufacturerPartNumber}</span>
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

          <div className="flex gap-3 flex-wrap">
            <button 
              onClick={handleAddToLibrary}
              disabled={addToLibraryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addToLibraryMutation.isPending ? 'Adding...' : `Add to Library (${selectedParts.length})`}
            </button>
            <button 
              onClick={handleAppendToExisting}
              disabled={selectedParts.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              title="Append distributor info to existing library part with same MFG P/N"
            >
              <Plus className="w-4 h-4" />
              Append to Existing Parts
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

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={stopCameraScanner}>
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Scan QR Code with Camera</h3>
              <button
                onClick={stopCameraScanner}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Camera Selection */}
            {cameraDevices.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Camera
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => {
                    const newCamera = e.target.value;
                    setSelectedCamera(newCamera);
                    // Restart scanner with new camera
                    if (scannerRef.current) {
                      scannerRef.current.stop().then(() => {
                        scannerRef.current = null;
                      }).catch(err => console.error('Error switching camera:', err));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  {cameraDevices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.label || `Camera ${device.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Scanner View */}
            <div className="relative">
              <div id="vendor-qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600"></div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
              Hold QR code in front of camera - scanning continuously
            </p>
          </div>
        </div>
      )}

      {/* Part Selection Modal */}
      {showPartSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {appendMode === 'distributor' ? 'Select Part to Update Distributors' : 'Select Part to Add Alternative'}
              </h3>
              <button
                onClick={() => {
                  setShowPartSelectionModal(false);
                  setLibraryPartsForAppend([]);
                  setAllLibraryParts([]);
                  setPartSearchTerm('');
                  setPartSortBy('part_number');
                  setAppendMode('');
                }}
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
                      setPartSearchTerm(term);
                      
                      // Filter parts based on search term
                      if (term.trim() === '') {
                        setLibraryPartsForAppend(allLibraryParts);
                      } else {
                        const filtered = allLibraryParts.filter(part => 
                          part.part_number?.toLowerCase().includes(term.toLowerCase()) ||
                          part.manufacturer_pn?.toLowerCase().includes(term.toLowerCase()) ||
                          part.description?.toLowerCase().includes(term.toLowerCase()) ||
                          part.manufacturer_name?.toLowerCase().includes(term.toLowerCase())
                        );
                        setLibraryPartsForAppend(filtered);
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <select
                    value={partSortBy}
                    onChange={(e) => setPartSortBy(e.target.value)}
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
                    onClick={() => handleSelectPartForAppend(component)}
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
                  onClick={() => {
                    setShowPartSelectionModal(false);
                    setLibraryPartsForAppend([]);
                    setAllLibraryParts([]);
                    setPartSearchTerm('');
                    setPartSortBy('part_number');
                    setAppendMode('');
                    handleAddToLibrary();
                  }}
                  className="mt-4 btn-primary"
                >
                  Add as New Part
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorSearch;

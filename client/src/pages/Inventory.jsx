import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { InventorySidebar, InventoryTable, QRCodeModal } from '../components/inventory';

// Debounce for the free-text filter so large inventories don't re-filter per keystroke
const SEARCH_DEBOUNCE_MS = 200;

const Inventory = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { canWrite } = useAuth();
  const { showError } = useNotification();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [pendingScanLookup, setPendingScanLookup] = useState(null);
  const [barcodeLibraryHit, setBarcodeLibraryHit] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState({});
  const [copiedLabel, setCopiedLabel] = useState('');
  const [qrCodeModal, setQrCodeModal] = useState(null);
  const [copiedQRField, setCopiedQRField] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [alternativesData, setAlternativesData] = useState({});
  const [editingAlternative, setEditingAlternative] = useState(null);
  const [sortBy, setSortBy] = useState('part_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [_receiveQtyFromQr, _setReceiveQtyFromQr] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Search input ref for auto-focus
  const searchInputRef = useRef(null);

  // Debounce the free-text filter input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle incoming UUID from Library page
  useEffect(() => {
    if (location.state?.searchUuid) {
      const uuidToSearch = location.state.searchUuid;
      setSearchTerm(uuidToSearch);
      // Clear the state to prevent re-searching on subsequent renders
      window.history.replaceState({}, document.title);
      // Select text after setting search term
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.select();
        }
      }, 0);
    }
  }, [location.state]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  });

  // Fetch projects for filter
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.data;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  // Fetch selected project details (component IDs)
  const { data: selectedProjectData } = useQuery({
    queryKey: ['project', selectedProject],
    queryFn: async () => {
      const response = await api.getProjectById(selectedProject);
      return response.data;
    },
    enabled: !!selectedProject,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch inventory with aggressive caching
  const { data: inventory, isLoading, refetch: refetchInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await api.getInventory();
      return response.data;
    },
    staleTime: 1000 * 60 * 15, // Data is fresh for 15 minutes
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  const { data: lowStock } = useQuery({
    queryKey: ['lowStock'],
    queryFn: async () => {
      const response = await api.getLowStockItems();
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch label templates
  const { data: labelTemplates } = useQuery({
    queryKey: ['labelTemplates'],
    queryFn: async () => {
      const response = await api.getLabelTemplates();
      return response.data;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
  });

  // Update quantity mutation
  const _updateQtyMutation = useMutation({
    mutationFn: async ({ id, quantity, location }) => {
      const updateData = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (location !== undefined) updateData.location = location;
      await api.updateInventory(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      queryClient.invalidateQueries(['lowStock']);
    },
  });

  // Build set of component IDs from selected project
  const projectComponentIds = useMemo(() => {
    if (!selectedProject || !selectedProjectData?.components) return null;
    return new Set(selectedProjectData.components.map(c => c.component_id).filter(Boolean));
  }, [selectedProject, selectedProjectData?.components]);

  // Compute unique locations from inventory data for the location filter
  const locationOptions = useMemo(() => {
    if (!inventory) return [];
    const locations = [...new Set(inventory.map(item => item.location || ''))];
    locations.sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
    return locations.map(loc => ({
      value: loc === '' ? '__none__' : loc,
      label: loc === '' ? 'No Location' : loc,
    }));
  }, [inventory]);

  // Filter inventory (against the debounced search term)
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    const searchLower = debouncedSearchTerm.toLowerCase();
    return inventory.filter(item => {
      const matchesCategory = !selectedCategory || item.category_name === selectedCategory;
      const matchesProject = !projectComponentIds || projectComponentIds.has(item.component_id);
      const matchesApproval = !selectedApprovalStatus || item.approval_status === selectedApprovalStatus;
      const matchesLocation = !selectedLocation ||
        (selectedLocation === '__none__' ? (!item.location || item.location === '') : item.location === selectedLocation);

      const matchesSearch = !debouncedSearchTerm ||
        item.part_number?.toLowerCase().includes(searchLower) ||
        item.manufacturer_pn?.toLowerCase().includes(searchLower) ||
        item.manufacturer_name?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.component_id?.toLowerCase().includes(searchLower) ||
        // Check if any alternative part matches the search
        (alternativesData[item.component_id]?.some(alt =>
          alt.manufacturer_pn?.toLowerCase().includes(searchLower) ||
          alt.manufacturer_name?.toLowerCase().includes(searchLower)
        ));
      return matchesCategory && matchesProject && matchesApproval && matchesLocation && matchesSearch;
    });
  }, [inventory, debouncedSearchTerm, selectedCategory, projectComponentIds, selectedApprovalStatus, selectedLocation, alternativesData]);

  // Sort inventory
  const sortedInventory = useMemo(() => {
    return filteredInventory.slice().sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle numeric fields
      if (sortBy === 'quantity' || sortBy === 'minimum_quantity') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      // Handle date fields
      if (sortBy === 'updated_at' || sortBy === 'created_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      }

      // Compare based on sort order
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredInventory, sortBy, sortOrder]);


  // Don't auto-expand rows - let users expand only what they need
  // This prevents fetching alternatives for all items on page load
  useEffect(() => {
    // Only expand rows if we have a specific filter (e.g., low stock)
    if (inventory && inventory.length > 0 && inventory.length <= 10) {
      // Auto-expand only if there are 10 or fewer items (e.g., filtered view)
      const allIds = new Set(inventory.map(item => item.id));
      setExpandedRows(allIds);
    } else {
      // Start with all rows collapsed for better performance
      setExpandedRows(new Set());
    }
  }, [inventory]);

  // Lazy load alternatives only when a row is expanded
  const fetchAlternativesForItem = useCallback(async (componentId) => {
    if (!alternativesData[componentId]) {
      try {
        const response = await api.getInventoryAlternatives(componentId);
        setAlternativesData(prev => ({
          ...prev,
          [componentId]: response.data
        }));
      } catch (error) {
        console.error('Error fetching alternatives:', error);
      }
    }
  }, [alternativesData]);

  // Fetch alternatives when rows are expanded
  useEffect(() => {
    if (inventory && expandedRows.size > 0) {
      // Only fetch for currently expanded rows
      inventory.forEach((item) => {
        if (expandedRows.has(item.id)) {
          fetchAlternativesForItem(item.component_id);
        }
      });
    }
  }, [expandedRows, inventory, fetchAlternativesForItem]);

  // Vendor barcode decode result from the scan panel (shared decoder). Only
  // decoded values reach this page — raw ECIA payloads stay inside the panel.
  const handleBarcodeDecode = useCallback((decoded) => {
    setBarcodeLibraryHit(null);
    if (decoded.error || !decoded.searchTerm) {
      setPendingScanLookup(null);
      return;
    }
    setSearchTerm(decoded.searchTerm);
    setPendingScanLookup(decoded);
  }, []);

  // Server fallback: a scanned part invisible in the client filter may still
  // exist in the library (e.g. SKU-only barcode — the client filter has no
  // distributor SKUs). Exact di.sku/MPN/PN match via /inventory/search/barcode.
  useEffect(() => {
    if (!pendingScanLookup || isLoading) return;
    // Wait until the filter reflects the scanned term
    if (debouncedSearchTerm !== pendingScanLookup.searchTerm) return;
    if (filteredInventory.length > 0) {
      setPendingScanLookup(null);
      return;
    }

    let cancelled = false;
    const lookup = async () => {
      const terms = [...new Set([pendingScanLookup.sku, pendingScanLookup.searchTerm].filter(Boolean))];
      for (const term of terms) {
        try {
          const response = await api.searchByBarcode(term);
          if (cancelled) return;
          if (response.data?.length > 0) {
            setBarcodeLibraryHit(response.data[0]);
            break;
          }
        } catch {
          // 404 = no match for this term; try the next one
        }
      }
      if (!cancelled) setPendingScanLookup(null);
    };
    lookup();
    return () => {
      cancelled = true;
    };
  }, [pendingScanLookup, debouncedSearchTerm, filteredInventory, isLoading]);

  // A scanned part hidden by the current filters: reset filters so it shows,
  // searching by the value the server matched on
  const handleShowBarcodeLibraryHit = useCallback(() => {
    if (!barcodeLibraryHit) return;
    setSelectedCategory('');
    setSelectedProject('');
    setSelectedApprovalStatus('');
    setSelectedLocation('');
    const term = barcodeLibraryHit.manufacturer_pn || barcodeLibraryHit.part_number || '';
    setSearchTerm(term);
    setBarcodeLibraryHit(null);
  }, [barcodeLibraryHit]);

  // Initialize edited items when entering edit mode
  const handleToggleEditMode = () => {
    if (!editMode) {
      // Entering edit mode - initialize with current values
      const initialEdits = {};
      filteredInventory?.forEach(item => {
        initialEdits[item.id] = {
          location: item.location || '',
          quantity: item.quantity,
          minimum_quantity: item.minimum_quantity || 0,
          consumeQty: 0,
          receiveQty: 0
        };
      });
      setEditedItems(initialEdits);
      
      // Initialize alternative parts edits
      const initialAltEdits = {};
      filteredInventory?.forEach(item => {
        const alternatives = alternativesData[item.component_id] || [];
        if (alternatives.length > 0) {
          alternatives.forEach(alt => {
            initialAltEdits[alt.id] = {
              location: alt.location || '',
              quantity: alt.quantity || 0,
              minimum_quantity: alt.minimum_quantity || 0,
              consumeQty: 0,
              receiveQty: 0
            };
          });
        }
      });
      setEditingAlternative(initialAltEdits);
    } else {
      // Exiting edit mode - clear edits
      setEditedItems({});
      setEditingAlternative({});
    }
    setEditMode(!editMode);
  };

  const handleEditChange = (id, field, value) => {
    setEditedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    const updates = [];
    
    // Save main inventory items
    for (const [id, changes] of Object.entries(editedItems)) {
      const originalItem = filteredInventory.find(item => item.id === id);
      if (!originalItem) continue;

      const updateData = {};
      
      // Check if location changed
      if (changes.location !== originalItem.location) {
        updateData.location = changes.location;
      }
      
      // Check if minimum_quantity changed
      if (changes.minimum_quantity !== originalItem.minimum_quantity) {
        updateData.minimum_quantity = changes.minimum_quantity;
      }
      
      // Check if quantity changed (either set, consume, or receive)
      let finalQuantity = changes.quantity;
      if (changes.consumeQty && changes.consumeQty > 0) {
        finalQuantity = Math.max(0, changes.quantity - parseInt(changes.consumeQty));
      }
      if (changes.receiveQty && changes.receiveQty > 0) {
        finalQuantity += parseInt(changes.receiveQty);
      }
      
      if (finalQuantity !== originalItem.quantity) {
        updateData.quantity = finalQuantity;
      }
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        updates.push(api.updateInventory(id, updateData));
      }
    }
    
    // Save alternative parts
    if (editingAlternative) {
      for (const [altId, changes] of Object.entries(editingAlternative)) {
        // Find the original alternative from alternativesData
        let originalAlt = null;
        for (const item of filteredInventory) {
          const alternatives = alternativesData[item.component_id] || [];
          originalAlt = alternatives.find(a => a.id === altId);
          if (originalAlt) break;
        }
        
        if (!originalAlt) continue;

        const updateData = {};
        
        // Check if location changed
        if (changes.location !== originalAlt.location) {
          updateData.location = changes.location;
        }
        
        // Check if minimum_quantity changed - send as min_quantity to backend
        if (changes.minimum_quantity !== originalAlt.minimum_quantity) {
          updateData.min_quantity = changes.minimum_quantity;
        }
        
        // Check if quantity changed (either set, consume, or receive)
        let finalQuantity = changes.quantity;
        if (changes.consumeQty && changes.consumeQty > 0) {
          finalQuantity = Math.max(0, changes.quantity - parseInt(changes.consumeQty));
        }
        if (changes.receiveQty && changes.receiveQty > 0) {
          finalQuantity += parseInt(changes.receiveQty);
        }
        
        if (finalQuantity !== originalAlt.quantity) {
          updateData.quantity = finalQuantity;
        }
        
        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          updates.push(api.updateAlternativeInventory(altId, updateData));
        }
      }
    }

    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        
        // Refresh main inventory data
        queryClient.invalidateQueries(['inventory']);
        queryClient.invalidateQueries(['lowStock']);
        
        // Refresh alternatives data for all affected components
        const affectedComponentIds = new Set();
        for (const item of filteredInventory) {
          const alternatives = alternativesData[item.component_id] || [];
          if (alternatives.some(alt => editingAlternative?.[alt.id])) {
            affectedComponentIds.add(item.component_id);
          }
        }
        
        // Fetch updated alternatives
        for (const componentId of affectedComponentIds) {
          try {
            const response = await api.getInventoryAlternatives(componentId);
            setAlternativesData(prev => ({
              ...prev,
              [componentId]: response.data
            }));
          } catch (error) {
            console.error('Error refreshing alternatives:', error);
          }
        }
        
        setEditMode(false);
        setEditedItems({});
        setEditingAlternative({});
      } catch (error) {
        showError('Error saving changes: ' + (error.message || 'Unknown error'));
      }
    } else {
      setEditMode(false);
      setEditedItems({});
      setEditingAlternative({});
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedItems({});
    setEditingAlternative({});
  };

  // Generate label string with QR code data
  const generateLabelString = (item) => {
    const mfgPn = item.manufacturer_pn || 'N/A';
    const desc = item.description || 'N/A';
    // For rich text copy, we'll use HTML format with bold MFG P/N (Issue #5)
    return `${mfgPn}\n${desc}`;
  };

  const copyLabelToClipboard = (item) => {
    const mfgPn = item.manufacturer_pn || 'N/A';
    const desc = item.description || 'N/A';
    const plainText = `${mfgPn}\n${desc}`;
    const htmlText = `<strong>${mfgPn}</strong><br>${desc}`;
    
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.write) {
      // Try to copy both HTML and plain text formats
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        })
      ]).then(() => {
        setCopiedLabel(item.id);
        setTimeout(() => setCopiedLabel(''), 2000);
      }).catch((err) => {
        console.error('Failed to copy rich text:', err);
        // Fallback to plain text only
        fallbackCopyToClipboard(plainText, item.id);
      });
    } else {
      fallbackCopyToClipboard(plainText, item.id);
    }
  };

  const copyQRFieldToClipboard = (text, fieldId) => {
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedQRField(fieldId);
        setTimeout(() => setCopiedQRField(''), 2000);
      }).catch((err) => {
        console.error('Failed to copy text:', err);
        fallbackCopyQRField(text, fieldId);
      });
    } else {
      fallbackCopyQRField(text, fieldId);
    }
  };

  // Fallback clipboard methods
  const fallbackCopyToClipboard = (text, itemId) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedLabel(itemId);
        setTimeout(() => setCopiedLabel(''), 2000);
      } else {
        showError('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      showError('Failed to copy to clipboard. Please copy manually.');
    }
  };

  const fallbackCopyQRField = (text, fieldId) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedQRField(fieldId);
        setTimeout(() => setCopiedQRField(''), 2000);
      } else {
        showError('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      showError('Failed to copy to clipboard. Please copy manually.');
    }
  };

  const copyQRImageToClipboard = async (qrValue, fieldId) => {
    try {
      // Check if clipboard API is available for images
      if (!navigator.clipboard || !navigator.clipboard.write) {
        showError('Image copying is not supported in your browser or context. Please use right-click > Save Image or screenshot the QR code.');
        return;
      }

      // Find the SVG element
      const svgElement = document.querySelector(`#qr-${fieldId} svg`);
      if (!svgElement) {
        showError('QR code not found. Please try again.');
        return;
      }

      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob and copy to clipboard
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopiedQRField(`img-${fieldId}`);
            setTimeout(() => setCopiedQRField(''), 2000);
          } catch (err) {
            console.error('Failed to copy QR code image:', err);
            showError('Failed to copy QR code image. Please try using right-click > Save Image or take a screenshot.');
          }
        });
      };
      
      img.onerror = () => {
        showError('Failed to load QR code image. Please try again.');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error copying QR code:', error);
      showError('Failed to copy QR code image. Please try using right-click > Save Image or take a screenshot.');
    }
  };

  const showQRCode = (item) => {
    const qrData = generateLabelString(item);
    const qrMfgOnly = item.manufacturer_pn || 'N/A';
    const qrUuid = item.component_id || 'N/A';
    setQrCodeModal({ item, qrData, qrMfgOnly, qrUuid });
  };

  // Copy QR code image directly with manufacturer part number only
  const copyQRCodeMfgOnly = async (item) => {
    try {
      const mfgPn = item.manufacturer_pn || 'N/A';
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);
      
      // Render QR code
      const root = ReactDOM.createRoot(container);
      await new Promise((resolve) => {
        root.render(<QRCodeSVG value={mfgPn} size={256} level="H" includeMargin={true} />);
        setTimeout(resolve, 100);
      });
      
      // Get SVG element
      const svg = container.querySelector('svg');
      if (!svg) {
        throw new Error('QR code SVG not generated');
      }
      
      // Serialize SVG to string
      const svgData = new XMLSerializer().serializeToString(svg);
      
      // Clean up
      root.unmount();
      document.body.removeChild(container);
      
      // Create an image from SVG
      const img = new Image();
      
      img.onload = async () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 256, 256);
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          try {
            // Copy to clipboard
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            
            // Show success feedback with unique item ID
            setCopiedQRField(`mfg-quick-${item.id}`);
            setTimeout(() => setCopiedQRField(''), 2000);
          } catch (err) {
            console.error('Clipboard write error:', err);
            showError('Failed to copy QR code image to clipboard.');
          }
        }, 'image/png');
      };
      
      img.onerror = () => {
        showError('Failed to load QR code image. Please try again.');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error copying QR code:', error);
      showError('Failed to copy QR code image.');
    }
  };

  // Copy QR code for alternative part (manufacturer P/N only)
  const copyAlternativeQRCodeMfgOnly = async (alt, _primaryItem) => {
    try {
      const mfgPn = alt.manufacturer_pn || 'N/A';
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);
      
      // Render QR code
      const root = ReactDOM.createRoot(container);
      await new Promise((resolve) => {
        root.render(<QRCodeSVG value={mfgPn} size={256} level="H" includeMargin={true} />);
        setTimeout(resolve, 100);
      });
      
      // Get SVG element
      const svg = container.querySelector('svg');
      if (!svg) {
        throw new Error('QR code SVG not generated');
      }
      
      // Serialize SVG to string
      const svgData = new XMLSerializer().serializeToString(svg);
      
      // Clean up
      root.unmount();
      document.body.removeChild(container);
      
      // Create an image from SVG
      const img = new Image();
      
      img.onload = async () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 256, 256);
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          try {
            // Copy to clipboard
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            
            // Show success feedback with unique alt ID
            setCopiedQRField(`alt-mfg-quick-${alt.id}`);
            setTimeout(() => setCopiedQRField(''), 2000);
          } catch (err) {
            console.error('Clipboard write error:', err);
            showError('Failed to copy QR code image to clipboard.');
          }
        }, 'image/png');
      };
      
      img.onerror = () => {
        showError('Failed to load QR code image. Please try again.');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error copying QR code:', error);
      showError('Failed to copy QR code image.');
    }
  };

  // Navigate to Library with component UUID or search term pre-filled
  const jumpToLibrary = (searchValue, isUuid = true) => {
    // Navigate to library with state containing the search value
    if (isUuid) {
      navigate('/library', { state: { searchUuid: searchValue } });
    } else {
      navigate('/library', { state: { searchTerm: searchValue } });
    }
  };

  // Toggle row expansion to show/hide alternatives
  const toggleRowExpansion = async (item) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(item.id)) {
      newExpanded.delete(item.id);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(item.id);
      setExpandedRows(newExpanded);
      
      // Fetch alternatives if not already loaded
      if (!alternativesData[item.component_id]) {
        try {
          const response = await api.getInventoryAlternatives(item.component_id);
          setAlternativesData(prev => ({
            ...prev,
            [item.component_id]: response.data
          }));
        } catch (error) {
          console.error('Error fetching alternatives:', error);
        }
      }
    }
  };

  // Update alternative inventory
  const updateAlternativeMutation = useMutation({
    mutationFn: async ({ altId, data }) => {
      await api.updateAlternativeInventory(altId, data);
    },
    onSuccess: (_, variables) => {
      // Refresh alternatives data
      const componentId = Object.keys(alternativesData).find(key => 
        alternativesData[key].some(alt => alt.id === variables.altId)
      );
      if (componentId) {
        api.getInventoryAlternatives(componentId).then(response => {
          setAlternativesData(prev => ({
            ...prev,
            [componentId]: response.data
          }));
        });
      }
      setEditingAlternative(null);
    },
  });

  const handleAlternativeEdit = (altId, field, value) => {
    setEditingAlternative(prev => ({
      ...prev,
      [altId]: {
        ...(prev?.[altId] || {}),
        [field]: value
      }
    }));
  };

  const _saveAlternativeChanges = (alt) => {
    if (editingAlternative && editingAlternative[alt.id]) {
      const changes = editingAlternative[alt.id];
      const updateData = {};
      
      // Handle location
      if (changes.location !== undefined) {
        updateData.location = changes.location;
      }
      
      // Handle minimum_quantity
      if (changes.minimum_quantity !== undefined) {
        updateData.minimum_quantity = changes.minimum_quantity;
      }
      
      // Handle quantity with consume logic
      let finalQuantity = changes.quantity !== undefined ? changes.quantity : alt.quantity;
      if (changes.consumeQty && changes.consumeQty > 0) {
        finalQuantity = Math.max(0, finalQuantity - parseInt(changes.consumeQty));
      }
      updateData.quantity = finalQuantity;
      
      updateAlternativeMutation.mutate({
        altId: alt.id,
        data: updateData
      });
    }
  };

  // Toggle expand/collapse all rows
  const handleToggleExpandAll = () => {
    if (expandedRows.size === sortedInventory?.length) {
      // All expanded - collapse all
      setExpandedRows(new Set());
    } else {
      // Some or none expanded - expand all
      const allIds = new Set(sortedInventory?.map(item => item.id));
      setExpandedRows(allIds);
    }
  };

  const generateAlternativeLabelString = (alt, parentItem) => {
    const mfgPn = alt.manufacturer_pn || 'N/A';
    const desc = parentItem.description || 'N/A';
    return `${mfgPn}\n${desc}`;
  };

  const copyAlternativeLabelToClipboard = (alt, parentItem) => {
    const mfgPn = alt.manufacturer_pn || 'N/A';
    const desc = parentItem.description || 'N/A';
    const plainText = `${mfgPn}\n${desc}`;
    const htmlText = `<strong>${mfgPn}</strong><br>${desc}`;
    
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.write) {
      // Try to copy both HTML and plain text formats
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        })
      ]).then(() => {
        setCopiedLabel(`alt-${alt.id}`);
        setTimeout(() => setCopiedLabel(''), 2000);
      }).catch((err) => {
        console.error('Failed to copy rich text:', err);
        // Fallback to plain text only
        fallbackCopyToClipboard(plainText, `alt-${alt.id}`);
      });
    } else {
      fallbackCopyToClipboard(plainText, `alt-${alt.id}`);
    }
  };

  const showAlternativeQRCode = (alt, parentItem) => {
    const qrData = generateAlternativeLabelString(alt, parentItem);
    const qrMfgOnly = alt.manufacturer_pn || 'N/A';
    const qrUuid = parentItem.component_id || 'N/A';
    setQrCodeModal({ 
      item: {
        part_number: parentItem.part_number,
        manufacturer_pn: alt.manufacturer_pn,
        description: parentItem.description,
        component_id: parentItem.component_id
      }, 
      qrData,
      qrMfgOnly,
      qrUuid
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 flex-1 overflow-hidden">

      {/* Left Sidebar - Controls */}
      <InventorySidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        selectedApprovalStatus={selectedApprovalStatus}
        onApprovalStatusChange={setSelectedApprovalStatus}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        locationOptions={locationOptions}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchClear={() => {
          setSearchTerm('');
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }}
        searchInputRef={searchInputRef}
        onSearchKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.target.select();
          }
        }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onBarcodeDecode={handleBarcodeDecode}
        barcodeLibraryHit={barcodeLibraryHit}
        onShowBarcodeLibraryHit={handleShowBarcodeLibraryHit}
        isBarcodeLookupPending={!!pendingScanLookup}
        searchResultCount={filteredInventory?.length}
        onNavigateVendorSearch={(mfgPn) => navigate('/vendor-search', { state: { searchFromInventory: mfgPn } })}
        labelTemplates={labelTemplates}
        selectedTemplate={selectedTemplate}
        onTemplateChange={setSelectedTemplate}
        lowStock={lowStock}
      />

      {/* Right Side - Inventory Table */}
      <InventoryTable
        sortedInventory={sortedInventory}
        editMode={editMode}
        editedItems={editedItems}
        expandedRows={expandedRows}
        alternativesData={alternativesData}
        editingAlternative={editingAlternative}
        copiedLabel={copiedLabel}
        copiedQRField={copiedQRField}
        canWrite={canWrite()}
        onToggleEditMode={handleToggleEditMode}
        onSaveAll={handleSaveAll}
        onCancelEdit={handleCancelEdit}
        onEditChange={handleEditChange}
        onAlternativeEdit={handleAlternativeEdit}
        onToggleExpandAll={handleToggleExpandAll}
        onToggleRowExpansion={toggleRowExpansion}
        onJumpToLibrary={jumpToLibrary}
        onShowQRCode={showQRCode}
        onCopyQRCodeMfgOnly={copyQRCodeMfgOnly}
        onCopyLabelToClipboard={copyLabelToClipboard}
        onShowAlternativeQRCode={showAlternativeQRCode}
        onCopyAlternativeQRCodeMfgOnly={copyAlternativeQRCodeMfgOnly}
        onCopyAlternativeLabelToClipboard={copyAlternativeLabelToClipboard}
        onRefetchInventory={() => refetchInventory()}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        qrCodeModal={qrCodeModal}
        onClose={() => setQrCodeModal(null)}
        onCopyQRImage={copyQRImageToClipboard}
        onCopyQRField={copyQRFieldToClipboard}
        copiedQRField={copiedQRField}
      />

      </div>
    </div>
  );
};

export default Inventory;

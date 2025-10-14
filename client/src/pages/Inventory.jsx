import { useState, useRef, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { Package, AlertCircle, Search, Edit, Printer, Copy, Check, QrCode, Save, X, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Inventory = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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

  // Search input ref for auto-focus
  const searchInputRef = useRef(null);

  // Auto-focus search field on page load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, []);

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
  });

  // Fetch inventory
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await api.getInventory();
      return response.data;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ['lowStock'],
    queryFn: async () => {
      const response = await api.getLowStockItems();
      return response.data;
    },
  });

  // Update quantity mutation
  const updateQtyMutation = useMutation({
    mutationFn: async ({ id, quantity, location }) => {
      const updateData = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (location !== undefined) updateData.location = location;
      await api.updateInventory(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      queryClient.invalidateQueries(['lowStock']);
      setEditingQty(null);
      setNewQty('');
      setEditingLocation(null);
      setNewLocation('');
    },
  });

  // SKU/Barcode search mutation (used for auto-search)
  const barcodeMutation = useMutation({
    mutationFn: async (barcode) => {
      const response = await api.searchByBarcode(barcode);
      return response.data;
    },
    onSuccess: (data) => {
      if (data && data.length > 0) {
        // Highlight the found item in the table
        const firstItem = data[0];
        const element = document.getElementById(`inv-row-${firstItem.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30');
          setTimeout(() => {
            element.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30');
          }, 2000);
        }
      }
    },
    onError: (error) => {
      // Silently fail for auto-searches
      console.log('SKU search: ' + (error.response?.data?.error || 'No match found'));
    },
  });

  // Filter inventory
  const filteredInventory = inventory?.filter(item => {
    const matchesCategory = !selectedCategory || item.category_name === selectedCategory;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
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
    return matchesCategory && matchesSearch;
  });

  // Sort inventory
  const sortedInventory = filteredInventory?.slice().sort((a, b) => {
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


  // Expand all rows by default and fetch alternatives when inventory loads
  useEffect(() => {
    if (inventory && inventory.length > 0) {
      const allIds = new Set(inventory.map(item => item.id));
      setExpandedRows(allIds);
      
      // Fetch alternatives for all components
      inventory.forEach(async (item) => {
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
      });
    }
  }, [inventory]);

  // Auto-search distributor SKU when no local matches found
  useEffect(() => {
    // Only trigger if search term exists, no local matches, and not already searching
    if (searchTerm && searchTerm.trim().length >= 3 && filteredInventory?.length === 0 && !barcodeMutation.isPending) {
      // Debounce to avoid excessive API calls
      const timer = setTimeout(() => {
        barcodeMutation.mutate(searchTerm.trim());
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, filteredInventory]);

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
          consumeQty: 0
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
              consumeQty: 0
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
      
      // Check if quantity changed (either set or consume)
      let finalQuantity = changes.quantity;
      if (changes.consumeQty && changes.consumeQty > 0) {
        finalQuantity = Math.max(0, changes.quantity - parseInt(changes.consumeQty));
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
        
        // Check if quantity changed (either set or consume)
        let finalQuantity = changes.quantity;
        if (changes.consumeQty && changes.consumeQty > 0) {
          finalQuantity = Math.max(0, changes.quantity - parseInt(changes.consumeQty));
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
        alert('Error saving changes: ' + (error.message || 'Unknown error'));
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
    return `${mfgPn}\n${desc}`;
  };

  const copyLabelToClipboard = (item) => {
    const labelText = generateLabelString(item);
    
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(labelText).then(() => {
        setCopiedLabel(item.id);
        setTimeout(() => setCopiedLabel(''), 2000);
      }).catch((err) => {
        console.error('Failed to copy text:', err);
        fallbackCopyToClipboard(labelText, item.id);
      });
    } else {
      fallbackCopyToClipboard(labelText, item.id);
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
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard. Please copy manually.');
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
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  };

  const copyQRImageToClipboard = async (qrValue, fieldId) => {
    try {
      // Check if clipboard API is available for images
      if (!navigator.clipboard || !navigator.clipboard.write) {
        alert('Image copying is not supported in your browser or context. Please use right-click > Save Image or screenshot the QR code.');
        return;
      }

      // Find the SVG element
      const svgElement = document.querySelector(`#qr-${fieldId} svg`);
      if (!svgElement) {
        alert('QR code not found. Please try again.');
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
            alert('Failed to copy QR code image. Please try using right-click > Save Image or take a screenshot.');
          }
        });
      };
      
      img.onerror = () => {
        alert('Failed to load QR code image. Please try again.');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error copying QR code:', error);
      alert('Failed to copy QR code image. Please try using right-click > Save Image or take a screenshot.');
    }
  };

  const showQRCode = (item) => {
    const qrData = generateLabelString(item);
    const qrMfgOnly = item.manufacturer_pn || 'N/A';
    const qrUuid = item.component_id || 'N/A';
    setQrCodeModal({ item, qrData, qrMfgOnly, qrUuid });
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

  const saveAlternativeChanges = (alt) => {
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
    const labelText = generateAlternativeLabelString(alt, parentItem);
    navigator.clipboard.writeText(labelText).then(() => {
      setCopiedLabel(`alt-${alt.id}`);
      setTimeout(() => setCopiedLabel(''), 2000);
    });
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
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left Sidebar - Controls */}
      <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
        {/* Title
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track and manage stock</p>
        </div> */}

        {/* Category Filter */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Filter by Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
          >
            <option value="">All Categories</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Box */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Search Inventory
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.select();
                }
              }}
              placeholder="Full data search ..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Searches all fields including distributor SKUs
          </p>
          
          {/* Sorting Controls */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 w-[52px]">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              >
                <option value="part_number">Part Number</option>
                <option value="manufacturer_pn">MFG Part Number</option>
                <option value="quantity">Quantity</option>
                <option value="location">Location</option>
                <option value="minimum_quantity">Min Quantity</option>
                <option value="updated_at">Last Edited</option>
              </select>
            </div>
            
            {/* Sort Order Toggle */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 w-[52px]">Order:</label>
              <div className="flex-1 flex items-center gap-2 border border-gray-300 dark:border-[#444444] rounded-md p-1">
                <button
                  onClick={() => setSortOrder('asc')}
                  className={`flex-1 py-1 text-xs rounded transition-colors ${
                    sortOrder === 'asc'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
                  }`}
                  title="Ascending"
                >
                  ↑ Asc
                </button>
                <button
                  onClick={() => setSortOrder('desc')}
                  className={`flex-1 py-1 text-xs rounded transition-colors ${
                    sortOrder === 'desc'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
                  }`}
                  title="Descending"
                >
                  ↓ Desc
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStock && lowStock.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300">Low Stock Alert</h3>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              {lowStock.length} item(s) running low
            </p>
          </div>
        )}
      </div>

      {/* Right Side - Inventory Table */}
      <div className="flex-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] overflow-hidden flex flex-col min-h-250">
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Inventory Items ({sortedInventory?.length || 0})
          </h3>
          {/* Edit Mode Controls */}
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={handleSaveAll}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save All
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleToggleExpandAll}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  {expandedRows.size === sortedInventory?.length ? (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Expand All
                    </>
                  )}
                </button>
                <button
                  onClick={handleToggleEditMode}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit All
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300" style={{width: '40px'}}></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Min Qty</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Library</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Label</th>
              </tr>
            </thead>
            <tbody>
              {sortedInventory?.map((item) => {
                const editedItem = editedItems[item.id] || { location: item.location || '', quantity: item.quantity, consumeQty: 0 };
                const isLowStock = item.quantity <= item.minimum_quantity && item.minimum_quantity > 0;
                const isExpanded = expandedRows.has(item.id);
                const alternatives = alternativesData[item.component_id] || [];
                
                return (
                  <Fragment key={item.id}>
                    <tr 
                      id={`inv-row-${item.id}`}
                      className="border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                    >
                      {/* Expand Button */}
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => toggleRowExpansion(item)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="Show/hide alternative parts"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Part Number */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.part_number}
                      </td>
                      
                      {/* MFG Part Number */}
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item.manufacturer_pn || 'N/A'}
                      </td>
                      
                      {/* Manufacturer */}
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item.manufacturer_name || 'N/A'}
                      </td>
                      
                      {/* Description */}
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item.description?.substring(0, 40) || 'N/A'}
                      </td>
                    
                    {/* Location */}
                    <td className="px-4 py-3 text-sm">
                      {editMode ? (
                        <input
                          type="text"
                          value={editedItem.location}
                          onChange={(e) => handleEditChange(item.id, 'location', e.target.value)}
                          placeholder="Enter location..."
                          className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{item.location || 'Not set'}</span>
                      )}
                    </td>
                    
                    {/* Quantity */}
                    <td className="px-4 py-3 text-sm">
                      {editMode ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Set to:</span>
                            <input
                              type="number"
                              value={editedItem.quantity}
                              onChange={(e) => handleEditChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Consume:</span>
                            <input
                              type="number"
                              value={editedItem.consumeQty || ''}
                              onChange={(e) => handleEditChange(item.id, 'consumeQty', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {item.quantity}
                          </span>
                          {isLowStock && (
                            <span className="text-xs text-red-600 dark:text-red-400">(Low)</span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Min Qty */}
                    <td className="px-4 py-3 text-sm">
                      {editMode ? (
                        <input
                          type="number"
                          value={editedItem.minimum_quantity}
                          onChange={(e) => handleEditChange(item.id, 'minimum_quantity', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{item.minimum_quantity || 0}</span>
                      )}
                    </td>
                    
                    {/* Library Jump Link */}
                    <td className="px-4 py-3 text-sm" style={{width: '70px'}}>
                      <button
                        onClick={() => jumpToLibrary(item.component_id)}
                        className="p-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                        title="View in Parts Library"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                    
                    {/* Label Actions */}
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showQRCode(item)}
                          className="px-3 py-1.5 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                          title="Show QR code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                        <button
                          onClick={() => copyLabelToClipboard(item)}
                          className={`px-3 py-1.5 flex items-center gap-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                            copiedLabel === item.id
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                          }`}
                          title="Copy label text"
                        >
                          {copiedLabel === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Alternative Parts Rows */}
                  {isExpanded && alternatives.length > 0 && alternatives.map((alt, altIndex) => {
                    const editingAlt = editingAlternative?.[alt.id] || {
                      location: alt.location || '',
                      quantity: alt.quantity || 0,
                      minimum_quantity: alt.minimum_quantity || 0,
                      consumeQty: 0
                    };

                    return (
                      <tr 
                        key={`alt-${alt.id}`}
                        className="bg-blue-50 dark:bg-blue-900/10 border-b border-gray-100 dark:border-[#3a3a3a]"
                      >
                        {/* Empty cell for alignment */}
                        <td className="px-4 py-2"></td>
                        
                        {/* Part Number - show as "Alt 1", "Alt 2", etc */}
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                          Alternative {altIndex + 1}
                        </td>
                        
                        {/* MFG Part Number */}
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {alt.manufacturer_pn}
                        </td>
                        
                        {/* Manufacturer */}
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {alt.manufacturer_name || 'N/A'}
                        </td>
                        
                        {/* Description - empty for alternatives */}
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                          (alternative part)
                        </td>
                        
                        {/* Location */}
                        <td className="px-4 py-2 text-sm">
                          {editMode ? (
                            <input
                              type="text"
                              value={editingAlt.location}
                              onChange={(e) => handleAlternativeEdit(alt.id, 'location', e.target.value)}
                              placeholder="Enter location..."
                              className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">{alt.location || 'Not set'}</span>
                          )}
                        </td>
                        
                        {/* Quantity */}
                        <td className="px-4 py-2 text-sm">
                          {editMode ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Set to:</span>
                                <input
                                  type="number"
                                  value={editingAlt.quantity}
                                  onChange={(e) => handleAlternativeEdit(alt.id, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Consume:</span>
                                <input
                                  type="number"
                                  value={editingAlt.consumeQty || ''}
                                  onChange={(e) => handleAlternativeEdit(alt.id, 'consumeQty', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">{alt.quantity || 0}</span>
                          )}
                        </td>
                        
                        {/* Min Qty - editable for alternatives */}
                        <td className="px-4 py-2 text-sm">
                          {editMode ? (
                            <input
                              type="number"
                              value={editingAlt.minimum_quantity}
                              onChange={(e) => handleAlternativeEdit(alt.id, 'minimum_quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">{alt.minimum_quantity || 0}</span>
                          )}
                        </td>
                        
                        {/* Library Jump Link for Alternative */}
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => jumpToLibrary(alt.manufacturer_pn, false)}
                            className="p-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="View in Parts Library"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                        
                        {/* Label Actions */}
                        <td className="px-4 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => showAlternativeQRCode(alt, item)}
                              className="px-3 py-1.5 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                              title="Show QR code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>QR</span>
                            </button>
                            <button
                              onClick={() => copyAlternativeLabelToClipboard(alt, item)}
                              className={`px-3 py-1.5 flex items-center gap-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                                copiedLabel === `alt-${alt.id}`
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                              }`}
                              title="Copy label text"
                            >
                              {copiedLabel === `alt-${alt.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {qrCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setQrCodeModal(null)}>
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-8 max-w-6xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">QR Codes</h3>
              <button
                onClick={() => setQrCodeModal(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-8">
              {/* QR Codes Display - Three Columns */}
              <div className="grid grid-cols-3 gap-8">
                {/* Full Data QR Code */}
                <div className="flex flex-col items-center">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Full Information</h4>
                  <div 
                    id="qr-full"
                    onClick={() => copyQRImageToClipboard(qrCodeModal.qrData, 'full')}
                    className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                    title="Click to copy QR code image"
                  >
                    <div className="bg-white p-4 inline-block">
                      <QRCodeSVG 
                        value={qrCodeModal.qrData} 
                        size={220}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  {copiedQRField === 'img-full' && (
                    <span className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold">QR Code Copied!</span>
                  )}
                  <button
                    onClick={() => copyQRFieldToClipboard(qrCodeModal.qrData, 'full-text')}
                    className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                    title="Click to copy text"
                  >
                    {qrCodeModal.qrData}
                  </button>
                  {copiedQRField === 'full-text' && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Text Copied!</span>
                  )}
                </div>

                {/* Manufacturer Part Number Only QR Code */}
                <div className="flex flex-col items-center">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">MFG Part Number</h4>
                  <div 
                    id="qr-mfg"
                    onClick={() => copyQRImageToClipboard(qrCodeModal.qrMfgOnly, 'mfg')}
                    className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                    title="Click to copy QR code image"
                  >
                    <div className="bg-white p-4 inline-block">
                      <QRCodeSVG 
                        value={qrCodeModal.qrMfgOnly} 
                        size={220}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  {copiedQRField === 'img-mfg' && (
                    <span className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold">QR Code Copied!</span>
                  )}
                  <button
                    onClick={() => copyQRFieldToClipboard(qrCodeModal.qrMfgOnly, 'mfg-text')}
                    className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                    title="Click to copy text"
                  >
                    {qrCodeModal.qrMfgOnly}
                  </button>
                  {copiedQRField === 'mfg-text' && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Text Copied!</span>
                  )}
                </div>

                {/* UUID QR Code */}
                <div className="flex flex-col items-center">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Component UUID</h4>
                  <div 
                    id="qr-uuid"
                    onClick={() => copyQRImageToClipboard(qrCodeModal.qrUuid || 'N/A', 'uuid')}
                    className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                    title="Click to copy QR code image"
                  >
                    <div className="bg-white p-4 inline-block">
                      <QRCodeSVG 
                        value={qrCodeModal.qrUuid || 'N/A'} 
                        size={220}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  {copiedQRField === 'img-uuid' && (
                    <span className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold">QR Code Copied!</span>
                  )}
                  <button
                    onClick={() => copyQRFieldToClipboard(qrCodeModal.qrUuid || 'N/A', 'uuid-text')}
                    className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                    title="Click to copy text"
                  >
                    {qrCodeModal.qrUuid || 'N/A'}
                  </button>
                  {copiedQRField === 'uuid-text' && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Text Copied!</span>
                  )}
                </div>
              </div>
              
              {/* Item Info */}
              <div className="space-y-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Part Number:</span>
                    <button
                      onClick={() => copyQRFieldToClipboard(qrCodeModal.item.part_number, 'info-pn')}
                      className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                      title="Click to copy"
                    >
                      {qrCodeModal.item.part_number}
                    </button>
                    {copiedQRField === 'info-pn' && (
                      <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">MFG Part Number:</span>
                    <button
                      onClick={() => copyQRFieldToClipboard(qrCodeModal.item.manufacturer_pn || 'N/A', 'info-mfg')}
                      className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                      title="Click to copy"
                    >
                      {qrCodeModal.item.manufacturer_pn || 'N/A'}
                    </button>
                    {copiedQRField === 'info-mfg' && (
                      <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Description:</span>
                  <button
                    onClick={() => copyQRFieldToClipboard(qrCodeModal.item.description || 'N/A', 'info-desc')}
                    className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                    title="Click to copy"
                  >
                    {qrCodeModal.item.description || 'N/A'}
                  </button>
                  {copiedQRField === 'info-desc' && (
                    <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Component UUID:</span>
                  <button
                    onClick={() => copyQRFieldToClipboard(qrCodeModal.item.component_id || 'N/A', 'info-uuid')}
                    className="text-gray-900 dark:text-gray-100 font-mono text-xs hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                    title="Click to copy"
                  >
                    {qrCodeModal.item.component_id || 'N/A'}
                  </button>
                  {copiedQRField === 'info-uuid' && (
                    <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;

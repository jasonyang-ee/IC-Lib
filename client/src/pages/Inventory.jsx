import { useState, useRef, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Package, AlertCircle, Search, Edit, Barcode, Printer, Copy, Check, QrCode, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Inventory = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState({});
  const [copiedLabel, setCopiedLabel] = useState('');
  const [qrCodeModal, setQrCodeModal] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [alternativesData, setAlternativesData] = useState({});
  const [editingAlternative, setEditingAlternative] = useState(null);
  const barcodeRef = useRef(null);

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

  // Barcode search mutation
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
      setBarcodeInput('');
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Component not found');
      setBarcodeInput('');
    },
  });

  // Filter inventory
  const filteredInventory = inventory?.filter(item => {
    const matchesCategory = !selectedCategory || item.category_name === selectedCategory;
    const matchesSearch = !searchTerm || 
      item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer_pn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
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
    } else {
      // Exiting edit mode - clear edits
      setEditedItems({});
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

    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        queryClient.invalidateQueries(['inventory']);
        queryClient.invalidateQueries(['lowStock']);
        setEditMode(false);
        setEditedItems({});
      } catch (error) {
        alert('Error saving changes: ' + (error.message || 'Unknown error'));
      }
    } else {
      setEditMode(false);
      setEditedItems({});
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedItems({});
  };

  const handleBarcodeSearch = () => {
    if (barcodeInput.trim()) {
      barcodeMutation.mutate(barcodeInput.trim());
    }
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeSearch();
    }
  };

  // Generate label string with QR code data
  const generateLabelString = (item) => {
    const mfgPn = item.manufacturer_pn || 'N/A';
    const desc = item.description || 'N/A';
    return `${mfgPn}\n${desc}`;
  };

  const copyLabelToClipboard = (item) => {
    const labelText = generateLabelString(item);
    navigator.clipboard.writeText(labelText).then(() => {
      setCopiedLabel(item.id);
      setTimeout(() => setCopiedLabel(''), 2000);
    });
  };

  const showQRCode = (item) => {
    const qrData = generateLabelString(item);
    setQrCodeModal({ item, qrData });
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
    if (expandedRows.size === filteredInventory?.length) {
      // All expanded - collapse all
      setExpandedRows(new Set());
    } else {
      // Some or none expanded - expand all
      const allIds = new Set(filteredInventory?.map(item => item.id));
      setExpandedRows(allIds);
    }
  };

  const generateAlternativeLabelString = (alt) => {
    const mfgPn = alt.manufacturer_pn || 'N/A';
    const mfgName = alt.manufacturer_name || 'Unknown';
    return `${mfgName}\n${mfgPn}`;
  };

  const copyAlternativeLabelToClipboard = (alt) => {
    const labelText = generateAlternativeLabelString(alt);
    navigator.clipboard.writeText(labelText).then(() => {
      setCopiedLabel(`alt-${alt.id}`);
      setTimeout(() => setCopiedLabel(''), 2000);
    });
  };

  const showAlternativeQRCode = (alt) => {
    const qrData = generateAlternativeLabelString(alt);
    setQrCodeModal({ 
      item: {
        part_number: `ALT-${alt.id}`,
        manufacturer_pn: alt.manufacturer_pn,
        description: alt.manufacturer_name
      }, 
      qrData 
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
        {/* Title */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track and manage stock</p>
        </div>

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
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Part number, MFG P/N, description..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
          </div>
        </div>

        {/* Barcode Scanner */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Barcode className="w-4 h-4 inline mr-1" />
            Scan Distributor Barcode
          </label>
          <div className="flex gap-2">
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleBarcodeKeyPress}
              placeholder="Enter SKU or scan barcode..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
            <button
              onClick={handleBarcodeSearch}
              disabled={barcodeMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 text-sm"
            >
              {barcodeMutation.isPending ? (
                <>Searching...</>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Find
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Searches Digikey, Mouser, Arrow, Newark SKUs
          </p>
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
      <div className="flex-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Inventory Items ({filteredInventory?.length || 0})
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
                  {expandedRows.size === filteredInventory?.length ? (
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
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300" style={{width: '40px'}}></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300" style={{minWidth: '200px'}}>Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Min Qty</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Label</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory?.map((item) => {
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
                    <td className="px-4 py-3 text-sm" style={{minWidth: '200px'}}>
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
                    const editingAlt = editingAlternative?.[alt.id] || {};
                    const isEditingThis = Object.keys(editingAlt).length > 0;

                    return (
                      <tr 
                        key={`alt-${alt.id}`}
                        className="bg-blue-50 dark:bg-blue-900/10 border-b border-gray-100 dark:border-[#3a3a3a]"
                      >
                        {/* Empty cell for alignment */}
                        <td className="px-4 py-2"></td>
                        
                        {/* Part Number - show as "Alt 1", "Alt 2", etc */}
                        <td className="px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
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
                              value={isEditingThis ? editingAlt.location : (alt.location || '')}
                              onChange={(e) => handleAlternativeEdit(alt.id, 'location', e.target.value)}
                              placeholder="Enter location..."
                              className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">{alt.location || 'Not set'}</span>
                          )}
                        </td>
                        
                        {/* Quantity */}
                        <td className="px-4 py-2 text-sm" style={{minWidth: '200px'}}>
                          {editMode ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Set to:</span>
                                <input
                                  type="number"
                                  value={isEditingThis ? editingAlt.quantity : (alt.quantity || 0)}
                                  onChange={(e) => handleAlternativeEdit(alt.id, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Consume:</span>
                                <input
                                  type="number"
                                  value={isEditingThis ? (editingAlt.consumeQty || '') : ''}
                                  onChange={(e) => handleAlternativeEdit(alt.id, 'consumeQty', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                                />
                              </div>
                              {isEditingThis && (
                                <button
                                  onClick={() => saveAlternativeChanges(alt)}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs self-start"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
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
                              value={editingAlt?.minimum_quantity ?? alt.minimum_quantity ?? 0}
                              onChange={(e) => handleAlternativeEdit(alt.id, 'minimum_quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">{alt.minimum_quantity || 0}</span>
                          )}
                        </td>
                        
                        {/* Label Actions */}
                        <td className="px-4 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => showAlternativeQRCode(alt)}
                              className="px-3 py-1.5 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                              title="Show QR code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>QR</span>
                            </button>
                            <button
                              onClick={() => copyAlternativeLabelToClipboard(alt)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setQrCodeModal(null)}>
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">QR Code</h3>
              <button
                onClick={() => setQrCodeModal(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-gray-200">
                <div className="text-center">
                  <div className="bg-white p-4 inline-block">
                    <QRCodeSVG 
                      value={qrCodeModal.qrData} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
              </div>
              
              {/* Item Info */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Part Number:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{qrCodeModal.item.part_number}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">MFG P/N:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{qrCodeModal.item.manufacturer_pn || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{qrCodeModal.item.description || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">QR Data:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100 font-mono text-xs">{qrCodeModal.qrData}</span>
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

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Package, AlertCircle, MapPin, Search, Edit, Barcode, Printer, Copy, Check } from 'lucide-react';

const Inventory = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [editingQty, setEditingQty] = useState(null);
  const [newQty, setNewQty] = useState('');
  const [consumeQty, setConsumeQty] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [newLocation, setNewLocation] = useState('');
  const [copiedLabel, setCopiedLabel] = useState('');
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
    mutationFn: async ({ id, quantity }) => {
      await api.updateInventory(id, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      queryClient.invalidateQueries(['lowStock']);
      setEditingQty(null);
      setNewQty('');
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

  const handleEditQty = (item) => {
    setEditingQty(item.id);
    setNewQty(item.quantity.toString());
    setConsumeQty('');
  };

  const handleSaveQty = (id) => {
    const qty = parseInt(newQty);
    if (!isNaN(qty) && qty >= 0) {
      updateQtyMutation.mutate({ id, quantity: qty });
    }
  };

  const handleConsumeQty = (item) => {
    const consume = parseInt(consumeQty);
    if (!isNaN(consume) && consume > 0) {
      const newQuantity = Math.max(0, item.quantity - consume);
      updateQtyMutation.mutate({ id: item.id, quantity: newQuantity });
    }
  };

  const handleEditLocation = (item) => {
    setEditingLocation(item.id);
    setNewLocation(item.location || '');
  };

  const handleSaveLocation = (id) => {
    updateQtyMutation.mutate({ id, location: newLocation });
    setEditingLocation(null);
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
    const qrData = item.manufacturer_pn || item.part_number;
    return `MFG P/N: ${item.manufacturer_pn || 'N/A'}\nDesc: ${item.description?.substring(0, 50) || 'N/A'}\nQR: ${qrData}`;
  };

  const copyLabelToClipboard = (item) => {
    const labelText = generateLabelString(item);
    navigator.clipboard.writeText(labelText).then(() => {
      setCopiedLabel(item.id);
      setTimeout(() => setCopiedLabel(''), 2000);
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
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Inventory Items ({filteredInventory?.length || 0})
          </h3>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Label</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory?.map((item) => {
                const isLowStock = item.quantity <= item.minimum_quantity && item.minimum_quantity > 0;
                return (
                  <tr 
                    key={item.id} 
                    id={`inv-row-${item.id}`}
                    className="border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.part_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.manufacturer_pn || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.manufacturer_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.description?.substring(0, 40) || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.category_name}</td>
                    <td className="px-4 py-3 text-sm">
                      {editingLocation === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newLocation}
                            onChange={(e) => setNewLocation(e.target.value)}
                            placeholder="Enter location..."
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveLocation(item.id)}
                            disabled={updateQtyMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingLocation(null)}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded transition-colors text-xs whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-900 dark:text-gray-100">{item.location || 'Not set'}</span>
                          <button
                            onClick={() => handleEditLocation(item)}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1 px-2 rounded transition-colors text-xs whitespace-nowrap"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingQty === item.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Set to:</span>
                            <input
                              type="number"
                              value={newQty}
                              onChange={(e) => setNewQty(e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveQty(item.id)}
                              disabled={updateQtyMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                            >
                              Save
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Consume:</span>
                            <input
                              type="number"
                              value={consumeQty}
                              onChange={(e) => setConsumeQty(e.target.value)}
                              placeholder="0"
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                            <button
                              onClick={() => handleConsumeQty(item)}
                              disabled={updateQtyMutation.isPending || !consumeQty}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                            >
                              Consume
                            </button>
                          </div>
                          <button
                            onClick={() => setEditingQty(null)}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded transition-colors text-xs whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.quantity}</span>
                          <button
                            onClick={() => handleEditQty(item)}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1 px-3 rounded transition-colors text-xs whitespace-nowrap"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => copyLabelToClipboard(item)}
                        className="flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors"
                        title="Copy label text for printing"
                      >
                        {copiedLabel === item.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Printer className="w-4 h-4" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;

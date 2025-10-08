import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Package, AlertCircle, MapPin } from 'lucide-react';

const Inventory = () => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600 mt-1">Track and manage your component inventory</p>
      </div>

      {/* Low Stock Alert */}
      {lowStock && lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Low Stock Alert</h3>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            {lowStock.length} item(s) are running low on stock
          </p>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Inventory Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Description</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Category</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Location</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Quantity</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Min. Qty</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory?.map((item) => {
                const isLowStock = item.quantity <= item.minimum_quantity && item.minimum_quantity > 0;
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{item.part_number}</td>
                    <td className="px-4 py-3 text-sm">{item.description?.substring(0, 40) || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{item.category_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {item.location || 'Not set'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.minimum_quantity || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      {isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
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

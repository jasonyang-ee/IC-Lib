/**
 * CategorySidebar - Category filter sidebar for Library page
 */
const CategorySidebar = ({ 
  categories = [], 
  selectedCategory, 
  onSelectCategory 
}) => {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex-shrink-0">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Category</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pt-3 custom-scrollbar space-y-2">
        <button
          onClick={() => onSelectCategory('')}
          className={`w-full text-left px-3 py-2 rounded ${
            selectedCategory === ''
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
              : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
          }`}
        >
          All Categories
        </button>
        {categories?.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`w-full text-left px-3 py-2 rounded ${
              selectedCategory === category.id
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySidebar;

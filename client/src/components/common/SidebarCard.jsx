const SidebarCard = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] ${className}`}>
    {title && (
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {Icon && <Icon className="w-4 h-4 inline mr-1" />}
        {title}
      </label>
    )}
    {children}
  </div>
);

export default SidebarCard;

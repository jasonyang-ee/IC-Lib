const StatusBadge = ({ status }) => {
  const colorMap = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    reviewing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    prototype: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    production: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  );
};

export default StatusBadge;

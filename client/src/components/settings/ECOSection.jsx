import { FileEdit } from 'lucide-react';

/**
 * ECO Section Component
 * Displays the "Engineer Change Order" section in the component details view
 * Only shown when CONFIG_ECO is enabled and user has write permissions
 */
const ECOSection = ({ isEnabled, canWrite, onInitiateECO }) => {
  // Don't render if ECO is not enabled or user doesn't have write permission
  if (!isEnabled || !canWrite) {
    return null;
  }

  return (
    <div className="col-span-3 border-t border-gray-200 dark:border-[#444444] pt-4 mt-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Engineer Change Order
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Use ECO to propose changes to this component. Changes will be reviewed by an approver before being applied.
        </p>
        <button
          onClick={onInitiateECO}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <FileEdit className="w-4 h-4" />
          Initiate ECO
        </button>
      </div>
    </div>
  );
};

export default ECOSection;

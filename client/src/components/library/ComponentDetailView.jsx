import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import ApprovalSection from './ApprovalSection';

/**
 * Helper component for a copyable text field with an aligned label.
 */
const CopyableField = ({ label, value, isLink, onCopy }) => (
  <div className="flex items-baseline gap-2 pb-2">
    <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">{label}:</span>
    {isLink ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate flex-1 px-1"
      >
        {value}
      </a>
    ) : (
      <span
        className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-1 rounded transition-colors truncate flex-1"
        onClick={() => onCopy(value, label)}
        title="Click to copy"
      >
        {value || 'N/A'}
      </span>
    )}
  </div>
);

/**
 * ComponentDetailView - Read-only component detail display.
 *
 * Shows part number, category, value, package, alternative parts selector,
 * manufacturer, MFG part number, description, CAD file links,
 * datasheet URL, and the approval section with action buttons.
 *
 * Props:
 * - componentDetails: object
 * - selectedComponent: object
 * - alternatives: array
 * - selectedAlternative: object
 * - setSelectedAlternative: setter
 * - onCopy: (text, label) => void
 * - canAccessFileLibrary: boolean
 * - canApprove: () => boolean
 * - canWrite: () => boolean
 * - updatingApproval: boolean
 * - onApprovalAction: (action) => void
 */
const ComponentDetailView = ({
  componentDetails,
  selectedComponent,
  alternatives,
  selectedAlternative,
  setSelectedAlternative,
  onCopy,
  canAccessFileLibrary,
  canApprove,
  canWrite,
  updatingApproval,
  onApprovalAction,
}) => {
  const navigate = useNavigate();

  if (!selectedComponent || !componentDetails) {
    return (
      <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Select a component to view details</p>
        <p className="text-sm mt-2">or click "Add Component" to create a new one</p>
      </div>
    );
  }

  const cadTypeMap = {
    schematic: { label: 'Schematic', routeType: 'schematic' },
    pcb_footprint: { label: 'Footprint', routeType: 'footprint' },
    pad_file: { label: 'Pad', routeType: 'pad' },
    step_model: { label: '3D Model', routeType: 'step' },
    pspice: { label: 'Pspice Model', routeType: 'pspice' },
  };

  const hasCadValue = (val) => {
    if (Array.isArray(val)) return val.length > 0;
    return val && val !== '[]';
  };

  return (
    <div className="col-span-2 space-y-1">
      {/* Each field in its own row with aligned labels */}
      <CopyableField label="Part Number" value={componentDetails.part_number} onCopy={onCopy} />
      <CopyableField label="Part Type" value={componentDetails.part_type || componentDetails.category_name} onCopy={onCopy} />
      <CopyableField label="Value" value={componentDetails.value} onCopy={onCopy} />
      <CopyableField label="Package" value={componentDetails.package_size} onCopy={onCopy} />

      {/* Alternative Parts Selection */}
      {alternatives && alternatives.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-2">
            Alt Parts{alternatives.length > 1 ? ` (${alternatives.length})` : ''}:
          </span>
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
            <select
              value={selectedAlternative?.id || ''}
              onChange={(e) => {
                const alt = alternatives.find(a => a.id === e.target.value);
                setSelectedAlternative(alt);
              }}
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm truncate"
            >
              {alternatives.map((alt) => (
                <option key={alt.id} value={alt.id}>
                  {alt.manufacturer_name || 'Unknown Mfg'} - {alt.manufacturer_pn}
                  {alt.is_primary ? ' (Primary)' : ''}
                </option>
              ))}
            </select>
            {canWrite() && (
              <button
                onClick={() => {
                  sessionStorage.setItem('libraryPartNumberForAlternative', selectedComponent.part_number);
                  navigate('/vendor-search');
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors shrink-0"
                title="Search for alternative parts"
              >
                <Search className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manufacturer and MFG Part Number */}
      <CopyableField
        label="Manufacturer"
        value={selectedAlternative?.manufacturer_name || componentDetails.manufacturer_name}
        onCopy={onCopy}
      />
      <CopyableField
        label="MFG Part Number"
        value={selectedAlternative?.manufacturer_pn || componentDetails.manufacturer_pn}
        onCopy={onCopy}
      />

      {/* Description */}
      {componentDetails.description && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-0.5">Description:</span>
          <p
            className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-1 rounded transition-colors flex-1"
            onClick={() => onCopy(componentDetails.description, 'Description')}
            title="Click to copy"
          >
            {componentDetails.description}
          </p>
        </div>
      )}

      {/* CAD Files - clickable to navigate to File Library */}
      {Object.entries(cadTypeMap).map(([field, config]) => {
        const val = componentDetails[field];
        if (!hasCadValue(val) && field !== 'pcb_footprint') return null;
        const files = Array.isArray(val) ? val : (val ? [val] : []);
        return (
          <div key={field} className="flex items-start gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-0.5">{config.label}:</span>
            <div className="flex-1 space-y-0 px-1">
              {files.length === 0 ? (
                <span className="text-sm text-gray-400 dark:text-gray-500">N/A</span>
              ) : files.map((fileName, idx) => (
                <div key={idx} className={idx > 0 ? 'border-gray-200 dark:border-[#444444] pt-0.5 mt-0.5' : ''}>
                  {canAccessFileLibrary ? (
                    <button
                      onClick={() => navigate(`/file-library?type=${config.routeType}&file=${encodeURIComponent(fileName)}`)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-mono"
                      title="View in File Library"
                    >
                      {fileName}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">{fileName}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Datasheet URL */}
      {componentDetails.datasheet_url && (
        <CopyableField label="Datasheet URL" value={componentDetails.datasheet_url} isLink onCopy={onCopy} />
      )}

      {/* Approval Status Section */}
      <ApprovalSection
        componentDetails={componentDetails}
        canApprove={canApprove}
        canWrite={canWrite}
        updatingApproval={updatingApproval}
        onApprovalAction={onApprovalAction}
      />
    </div>
  );
};

export default ComponentDetailView;

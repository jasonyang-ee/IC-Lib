import { Plus, X } from 'lucide-react';

const SpecificationsEditor = ({ editData, isAddMode, onFieldChange, onOpenMappingModal }) => {
  const specifications = editData.specifications || [];

  const handleAddSpec = () => {
    const newSpec = {
      category_spec_id: null,
      spec_name: '',
      spec_value: '',
      unit: '',
      mapping_spec_names: [],
      is_required: false,
      is_custom: true
    };
    onFieldChange('specifications', [...specifications, newSpec]);
  };

  const handleSpecChange = (index, field, value) => {
    const newSpecs = [...specifications];
    newSpecs[index] = { ...newSpecs[index], [field]: value };
    onFieldChange('specifications', newSpecs);
  };

  const handleRemoveMapping = (specIndex, keywordIndex) => {
    const newSpecs = [...specifications];
    const newMappings = (specifications[specIndex].mapping_spec_names || []).filter((_, ki) => ki !== keywordIndex);
    newSpecs[specIndex] = { ...newSpecs[specIndex], mapping_spec_names: newMappings };
    onFieldChange('specifications', newSpecs);
  };

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Specifications</h3>
        <button
          type="button"
          onClick={handleAddSpec}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs font-medium flex items-center gap-1 px-2 py-1 border border-primary-600 dark:border-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
        >
          <Plus className="w-3 h-3" />
          <span>Add Spec</span>
        </button>
      </div>
      <div className="text-sm">
        {specifications.length > 0 ? (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(100px,1fr)_minmax(100px,1.5fr)_minmax(50px,0.5fr)_minmax(150px,2fr)_auto] gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
              <span>Spec Name</span>
              <span>Value</span>
              <span>Unit</span>
              <span>Keywords (Vendor Mapping)</span>
              <span></span>
            </div>
            {specifications.map((spec, index) => (
              <div key={index} className="grid grid-cols-[minmax(100px,1fr)_minmax(100px,1.5fr)_minmax(50px,0.5fr)_minmax(150px,2fr)_auto] gap-2 items-start">
                {/* Spec Name */}
                {spec.is_custom ? (
                  <input
                    type="text"
                    value={spec.spec_name || ''}
                    onChange={(e) => handleSpecChange(index, 'spec_name', e.target.value)}
                    placeholder="Spec Name"
                    className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                  />
                ) : (
                  <div className="flex items-center py-1">
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {spec.spec_name}
                      {spec.is_required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                )}
                {/* Value */}
                <input
                  type="text"
                  value={spec.spec_value || ''}
                  onChange={(e) => handleSpecChange(index, 'spec_value', e.target.value)}
                  placeholder="Value"
                  className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                />
                {/* Unit */}
                {spec.is_custom ? (
                  <input
                    type="text"
                    value={spec.unit || ''}
                    onChange={(e) => handleSpecChange(index, 'unit', e.target.value)}
                    placeholder="Unit"
                    className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                  />
                ) : (
                  <div className="flex items-center py-1 text-xs text-gray-500 dark:text-gray-400">
                    {spec.unit || '-'}
                  </div>
                )}
                {/* Keywords */}
                <div className="flex flex-wrap gap-1 items-center min-h-6.5">
                  {(spec.mapping_spec_names || []).map((keyword, keywordIndex) => (
                    <span
                      key={keywordIndex}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveMapping(index, keywordIndex)}
                        className="ml-0.5 text-blue-500 dark:text-blue-400 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => onOpenMappingModal(index, spec)}
                    className="text-xs px-1.5 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-dashed border-blue-300 dark:border-blue-700 transition-colors flex items-center gap-0.5"
                    title="Add keyword mapping"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isAddMode ? 'Select a category to see available specifications, or add custom specs' : 'No specifications defined. Click "Add Spec" to add custom specifications.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default SpecificationsEditor;

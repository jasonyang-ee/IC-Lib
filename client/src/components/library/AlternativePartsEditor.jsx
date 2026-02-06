import { Plus, ChevronDown } from 'lucide-react';

const AlternativePartsEditor = ({
  editData,
  manufacturers,
  distributors,
  altManufacturerInputs,
  setAltManufacturerInputs,
  altManufacturerOpen,
  setAltManufacturerOpen,
  altManufacturerRefs,
  onAddAlternative,
  onDeleteAlternative,
  onPromoteToPrimary,
  onUpdateAlternative,
  onUpdateAlternativeDistributor
}) => {
  const alternatives = editData.alternatives || [];

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Alternative Parts
        </h3>
        <button
          type="button"
          onClick={onAddAlternative}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1 px-3 py-1.5 border border-primary-600 dark:border-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20"
        >
          <span>+ Add Alternative</span>
        </button>
      </div>

      {alternatives.length === 0 ? (
        <div className="px-4 py-8 border-2 border-dashed border-gray-300 dark:border-[#444444] rounded-md bg-gray-50 dark:bg-[#252525] text-gray-500 dark:text-gray-400 text-sm text-center">
          No alternative parts added yet. Click &quot;+ Add Alternative&quot; to add one.
        </div>
      ) : (
        <div className="space-y-3 max-h-150 overflow-y-auto pr-2 custom-scrollbar">
          {alternatives.map((alt, altIndex) => (
            <AlternativeCard
              key={altIndex}
              alt={alt}
              altIndex={altIndex}
              manufacturers={manufacturers}
              distributors={distributors}
              manufacturerInput={altManufacturerInputs[altIndex] || ''}
              manufacturerOpen={altManufacturerOpen[altIndex]}
              manufacturerRef={el => altManufacturerRefs.current[altIndex] = el}
              onManufacturerInputChange={(value) => setAltManufacturerInputs(prev => ({ ...prev, [altIndex]: value }))}
              onManufacturerOpenToggle={(open) => setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: open }))}
              onDelete={() => onDeleteAlternative(altIndex)}
              onPromote={() => onPromoteToPrimary(altIndex)}
              onUpdate={(field, value) => onUpdateAlternative(altIndex, field, value)}
              onUpdateDistributor={(distIndex, field, value) => onUpdateAlternativeDistributor(altIndex, distIndex, field, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AlternativeCard = ({
  alt,
  altIndex,
  manufacturers,
  distributors,
  manufacturerInput,
  manufacturerOpen,
  manufacturerRef,
  onManufacturerInputChange,
  onManufacturerOpenToggle,
  onDelete,
  onPromote,
  onUpdate,
  onUpdateDistributor
}) => {
  const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
  const altDistributors = alt.distributors || [];

  const normalizedDistributors = distributorOrder.map(distName => {
    const dist = distributors?.find(d => d.name === distName);
    const existing = altDistributors.find(d => {
      const existingDistName = distributors?.find(distObj => distObj.id === d.distributor_id)?.name;
      return existingDistName === distName;
    });
    return {
      distributor_id: dist?.id || null,
      distributor_name: distName,
      sku: existing?.sku || '',
      url: existing?.url || ''
    };
  });

  // Normalize distributors if needed
  if (JSON.stringify(altDistributors) !== JSON.stringify(normalizedDistributors)) {
    onUpdate('distributors', normalizedDistributors);
  }

  return (
    <div className="border border-gray-300 dark:border-[#444444] rounded-md p-4 bg-white dark:bg-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Alternative #{altIndex + 1}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPromote}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-600 dark:border-blue-400"
            title="Promote this alternative to become the primary part"
          >
            Promote to Primary
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete alternative"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Manufacturer and MFG Part Number */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div ref={manufacturerRef} className="relative">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Manufacturer <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={manufacturerInput}
              onChange={(e) => {
                onManufacturerInputChange(e.target.value);
                onManufacturerOpenToggle(true);
              }}
              onFocus={() => onManufacturerOpenToggle(true)}
              placeholder="Type or select"
              className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => onManufacturerOpenToggle(!manufacturerOpen)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            {manufacturerOpen && (() => {
              const filtered = manufacturers?.filter(mfr =>
                mfr.name.toLowerCase().includes((manufacturerInput || '').toLowerCase())
              ) || [];
              const exactMatch = filtered.find(mfr =>
                mfr.name.toLowerCase() === (manufacturerInput || '').toLowerCase()
              );
              const showCreateOption = (manufacturerInput || '').trim() && !exactMatch;

              return (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                  {showCreateOption && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdate('manufacturer_id', `NEW:${manufacturerInput.trim()}`);
                        onManufacturerOpenToggle(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Use new: &quot;{manufacturerInput.trim()}&quot; (will be added on save)
                    </button>
                  )}
                  {filtered.length > 0 ? (
                    filtered.map(mfr => (
                      <button
                        key={mfr.id}
                        type="button"
                        onClick={() => {
                          onManufacturerInputChange(mfr.name);
                          onUpdate('manufacturer_id', mfr.id);
                          onManufacturerOpenToggle(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm ${
                          alt.manufacturer_id === mfr.id
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                            : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {mfr.name}
                      </button>
                    ))
                  ) : !showCreateOption && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No manufacturers found
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            MFG Part Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={alt.manufacturer_pn || ''}
            onChange={(e) => onUpdate('manufacturer_pn', e.target.value)}
            placeholder="e.g., RC0805FR"
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
          />
        </div>
      </div>

      {/* Distributors */}
      <div className="border-t border-gray-200 dark:border-[#444444] pt-3 mt-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Distributors
        </label>
        <div className="space-y-1">
          {normalizedDistributors.map((dist, distIndex) => (
            <div key={distIndex} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
              <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                {dist.distributor_name}
              </div>
              <input
                type="text"
                value={dist.sku || ''}
                onChange={(e) => onUpdateDistributor(distIndex, 'sku', e.target.value)}
                placeholder="SKU"
                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
              <input
                type="text"
                value={dist.url || ''}
                onChange={(e) => onUpdateDistributor(distIndex, 'url', e.target.value)}
                placeholder="Product URL"
                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlternativePartsEditor;

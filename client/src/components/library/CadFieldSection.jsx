import { useState } from 'react';
import { X, Plus, FileText } from 'lucide-react';
import CadFilePickerModal from './CadFilePickerModal';

const FILE_TYPE_LABELS = {
  pcb_footprint: 'PCB Footprint',
  schematic: 'Schematic Symbol',
  step_model: 'STEP 3D Model',
  pspice: 'PSpice Model',
  pad_file: 'Pad File',
};

const FIELD_TO_CAD_TYPE = {
  pcb_footprint: 'footprint',
  schematic: 'symbol',
  step_model: 'model',
  pspice: 'pspice',
  pad_file: 'pad',
};

// Which fields support multiple files per the requirement
const SUPPORTS_MULTIPLE = {
  pcb_footprint: true,
  pad_file: true,
  schematic: false,
  step_model: false,
  pspice: false,
};

/**
 * CAD file section for component add/edit forms.
 * Shows existing linked files as static items with unlink buttons,
 * and "add existing file" buttons. Supports both add and edit modes.
 *
 * Props:
 * - field: string (e.g., 'pcb_footprint')
 * - values: string[] - current array of filenames
 * - onChange: (newArray) => void
 * - isEditMode: boolean - true=edit, false=add
 * - isAddMode: boolean - true=add mode
 * - componentId: string (optional) - for edit mode
 * - mfgPartNumber: string (optional) - for rename presets
 * - packageSize: string (optional) - for rename presets
 * - suggestions: string[] (optional) - legacy suggestions for add mode input
 * - categoryId: string (optional)
 */
export default function CadFieldSection({
  field,
  values = [],
  onChange,
  isEditMode = false,
  isAddMode = false,
  mfgPartNumber = '',
  packageSize = '',
  suggestions: _suggestions = [],
  categoryId: _categoryId,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [renameMode, setRenameMode] = useState(null); // index being renamed
  const [renameValue, setRenameValue] = useState('');

  const label = FILE_TYPE_LABELS[field] || field;
  const cadType = FIELD_TO_CAD_TYPE[field];
  const supportsMultiple = SUPPORTS_MULTIPLE[field];
  const hasValue = values.length > 0;
  const canAddMore = supportsMultiple || !hasValue;

  const handleRemove = (index) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const handleAdd = (fileName) => {
    if (!fileName || values.includes(fileName)) return;
    if (!supportsMultiple && hasValue) return;
    onChange([...values, fileName]);
  };

  const handleAddFromInput = () => {
    if (inputValue.trim()) {
      handleAdd(inputValue.trim());
      setInputValue('');
      setShowAddInput(false);
    }
  };

  const handlePickerSelect = (file) => {
    handleAdd(file.file_name);
  };

  const handleStartRename = (index) => {
    setRenameMode(index);
    setRenameValue(values[index]);
  };

  const handleConfirmRename = (index) => {
    if (renameValue.trim() && renameValue !== values[index]) {
      const ext = values[index].includes('.') ? values[index].substring(values[index].lastIndexOf('.')) : '';
      let newName = renameValue.trim();
      // Preserve extension if not included
      if (ext && !newName.endsWith(ext)) {
        newName += ext;
      }
      const newValues = [...values];
      newValues[index] = newName;
      onChange(newValues);
    }
    setRenameMode(null);
    setRenameValue('');
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>

      {/* Existing files */}
      {values.map((fileName, index) => (
        <div key={`${fileName}-${index}`} className="flex items-center gap-1.5 group">
          {renameMode === index && isAddMode ? (
            /* Rename input (only in add mode) */
            <div className="flex-1 flex items-center gap-1">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename(index)}
                className="flex-1 px-2 py-1 text-xs border border-primary-300 dark:border-primary-600 rounded bg-white dark:bg-[#333333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
              <button
                onClick={() => handleConfirmRename(index)}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => setRenameMode(null)}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Static file display */
            <>
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate font-mono">
                {fileName}
              </span>
              {/* Rename presets (only in add mode) */}
              {isAddMode && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {mfgPartNumber && (
                    <button
                      onClick={() => {
                        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const newValues = [...values];
                        newValues[index] = mfgPartNumber + ext;
                        onChange(newValues);
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-[#444444]"
                      title="Rename to MPN"
                    >
                      MPN
                    </button>
                  )}
                  {packageSize && (
                    <button
                      onClick={() => {
                        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const newValues = [...values];
                        newValues[index] = packageSize + ext;
                        onChange(newValues);
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-[#444444]"
                      title="Rename to Package"
                    >
                      PKG
                    </button>
                  )}
                  <button
                    onClick={() => handleStartRename(index)}
                    className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-[#444444]"
                    title="Custom rename"
                  >
                    Rename
                  </button>
                </div>
              )}
              {/* Remove link button */}
              <button
                onClick={() => handleRemove(index)}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title={isEditMode ? 'Remove link (file stays in library)' : 'Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add buttons */}
      {canAddMore && (
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => setShowPicker(true)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add existing file
          </button>

          {isAddMode && !showAddInput && (
            <button
              onClick={() => setShowAddInput(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              or type name
            </button>
          )}
        </div>
      )}

      {/* Manual input (add mode only) */}
      {showAddInput && isAddMode && (
        <div className="flex items-center gap-1 mt-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFromInput();
              if (e.key === 'Escape') setShowAddInput(false);
            }}
            placeholder={`Enter ${label.toLowerCase()} name`}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#444444] rounded bg-white dark:bg-[#333333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
          />
          <button onClick={handleAddFromInput} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Add</button>
          <button onClick={() => { setShowAddInput(false); setInputValue(''); }} className="text-xs text-gray-500 hover:underline">Cancel</button>
        </div>
      )}

      {/* File Picker Modal */}
      <CadFilePickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handlePickerSelect}
        fileType={cadType}
        excludeFileIds={[]}
      />
    </div>
  );
}

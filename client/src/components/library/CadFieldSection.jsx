import { useState } from 'react';
import { X, Plus, FileText, AlertCircle } from 'lucide-react';
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

// Pad files cannot be renamed - names are managed by footprint files internally
const RENAMEABLE_FIELDS = ['pcb_footprint', 'schematic', 'step_model', 'pspice'];

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
  const [renameConfirm, setRenameConfirm] = useState({ show: false, index: -1, newName: '', type: '' });

  const label = FILE_TYPE_LABELS[field] || field;
  const cadType = FIELD_TO_CAD_TYPE[field];
  const supportsMultiple = SUPPORTS_MULTIPLE[field];
  const canRename = RENAMEABLE_FIELDS.includes(field);
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

  const handleMpnRename = (index) => {
    const fileName = values[index];
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const newName = mfgPartNumber + ext;
    if (newName === fileName) return;
    setRenameConfirm({ show: true, index, newName, type: 'MPN' });
  };

  const handlePkgRename = (index) => {
    const fileName = values[index];
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const newName = packageSize + ext;
    if (newName === fileName) return;
    setRenameConfirm({ show: true, index, newName, type: 'Package' });
  };

  const handleConfirmRenamePreset = () => {
    const { index, newName } = renameConfirm;
    const newValues = [...values];
    newValues[index] = newName;
    onChange(newValues);
    setRenameConfirm({ show: false, index: -1, newName: '', type: '' });
  };

  const dismissRenameConfirm = () => {
    setRenameConfirm({ show: false, index: -1, newName: '', type: '' });
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>

      {/* Existing files */}
      {values.map((fileName, index) => (
        <div key={`${fileName}-${index}`} className="flex items-start gap-1.5 group">
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
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 break-all font-mono">
                {fileName}
              </span>
              {/* Rename presets (only in add mode and for renameable fields) */}
              {isAddMode && canRename && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {mfgPartNumber && (
                    <button
                      onClick={() => handleMpnRename(index)}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-[#444444]"
                      title="Rename to MPN"
                    >
                      MPN
                    </button>
                  )}
                  {packageSize && (
                    <button
                      onClick={() => handlePkgRename(index)}
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
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Rename Confirmation Modal */}
      {renameConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={dismissRenameConfirm}>
          <div
            className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Rename to {renameConfirm.type}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              This will change the file name reference for this component.
            </p>
            <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 font-mono text-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Current</div>
              <div className="text-gray-700 dark:text-gray-300 break-all">{values[renameConfirm.index]}</div>
              <div className="text-gray-400 text-center my-2">&darr;</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">New</div>
              <div className="text-primary-600 dark:text-primary-400 break-all font-semibold">{renameConfirm.newName}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={dismissRenameConfirm}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRenamePreset}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

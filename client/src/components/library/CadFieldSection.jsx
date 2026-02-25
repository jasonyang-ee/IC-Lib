import { FileText } from 'lucide-react';

const FILE_TYPE_LABELS = {
  schematic: 'Schematic Symbol',
  pcb_footprint: 'PCB Footprint',
  pad_file: 'Pad File',
  step_model: 'STEP 3D Model',
  pspice: 'PSpice Model',
};

/**
 * Strip file extension for display (CIS integration shows base names only).
 */
const stripExt = (name) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.substring(0, dotIndex) : name;
};

/**
 * Passive CAD file info display for component forms.
 * Shows the list of linked file base names (no extensions) as read-only text.
 * Actual file management (link, rename, delete) happens in ComponentFiles.
 *
 * Props:
 * - field: string (e.g., 'pcb_footprint')
 * - values: string[] - current array of filenames
 */
export default function CadFieldSection({ field, values = [] }) {
  const label = FILE_TYPE_LABELS[field] || field;
  // Filter out .dra files - CIS only needs .psm for footprints
  const filtered = values.filter(v => !v.toLowerCase().endsWith('.dra'));

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {filtered.length === 0 ? (
        <span className="text-xs text-gray-400 dark:text-gray-500 italic">None</span>
      ) : (
        filtered.map((fileName, index) => (
          <div key={`${fileName}-${index}`} className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-800 dark:text-gray-200 break-all font-mono">
              {stripExt(fileName)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

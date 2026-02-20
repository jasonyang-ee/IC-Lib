import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X, File } from 'lucide-react';

/**
 * Multi-value CAD field editor with card/list layout.
 * Renders existing values as individual list items with an input + dropdown for adding new entries.
 *
 * Props:
 *   label       - Display label
 *   values      - Array of current filenames
 *   suggestions - Array of suggestion strings from existing DB values
 *   onChange     - (newArray) => void
 *   placeholder  - Input placeholder text
 *   categoryId  - Used to gate suggestion dropdown visibility
 */
const CadFieldEditor = ({ label, values = [], suggestions = [], onChange, placeholder, categoryId }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addValue = (val) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    // Deduplicate
    if (values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInputValue('');
    setIsOpen(false);
  };

  const removeValue = (idx) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue(inputValue);
    }
  };

  // Filter suggestions: exclude already-added values, match input text
  const filtered = suggestions.filter(
    (s) => !values.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <div className="col-span-2" ref={containerRef}>
      <label className="block text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>

      {/* File list - card layout */}
      {values.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {values.map((v, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-md group"
            >
              <File className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{v}</span>
              <button
                type="button"
                onClick={() => removeValue(idx)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="relative flex items-center gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => addValue(inputValue)}
          disabled={!inputValue.trim()}
          className="px-2 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
          title="Add entry"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestion dropdown */}
      {isOpen && categoryId && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : 'auto' }}
        >
          {filtered.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => addValue(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CadFieldEditor;

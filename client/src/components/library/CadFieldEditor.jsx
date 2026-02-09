import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';

/**
 * Multi-value CAD field editor with chip/tag array pattern.
 * Renders existing values as removable chips with an input + dropdown for adding new entries.
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
      <label className="block text-gray-600 dark:text-gray-400 mb-1">{label}</label>

      {/* Chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {values.map((v, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 text-xs"
            >
              {v}
              <button
                type="button"
                onClick={() => removeValue(idx)}
                className="hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
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

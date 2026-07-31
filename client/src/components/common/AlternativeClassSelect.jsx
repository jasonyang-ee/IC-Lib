import { useId } from 'react';
import { ALTERNATIVE_CLASS_OPTIONS, toAlternativeClassValue } from '../../utils/alternativeClass';

/**
 * §V59 alternative-class picker. A native select so label association,
 * keyboard, and screen-reader behaviour come for free.
 *
 * `value` is the stored class (null for unrated); `onChange` receives the
 * same shape back - null, or the letter - so callers can put it straight in
 * an API payload. `unratedLabel` renames only the null choice, which the
 * project override needs ("Use library default" rather than "Unrated").
 */
const AlternativeClassSelect = ({
  value,
  onChange,
  label = 'Alternative Class',
  unratedLabel,
  disabled = false,
  className = '',
  // Library's edit grid labels its fields more quietly than the app default.
  labelClassName = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
  id,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={className}>
      <label htmlFor={selectId} className={labelClassName}>
        {label}
      </label>
      <select
        id={selectId}
        value={toAlternativeClassValue(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {ALTERNATIVE_CLASS_OPTIONS.map((option) => (
          <option key={option.value || 'unrated'} value={option.value} title={option.description}>
            {option.value === '' && unratedLabel ? unratedLabel : option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AlternativeClassSelect;

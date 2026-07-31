import { describeAlternativeClass, formatAlternativeClass } from '../../utils/alternativeClass';

// Unrated is deliberately the neutral grey rather than a warning colour: it
// is the safe default state for a part nobody has rated yet (§V59), not a
// defect. A/B/C run tightest-to-loosest substitution rule.
const toneClassName = (value) => {
  if (value === 'A') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (value === 'B') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (value === 'C') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

/**
 * §V59 class badge. `value` is the resolved class for the row; pass
 * `overridden` on a project line whose own override is what produced it, so
 * the operator can tell a line override from the library default.
 */
const AlternativeClassBadge = ({ value, overridden = false, className = '' }) => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : null;
  const label = formatAlternativeClass(normalized);
  const description = describeAlternativeClass(normalized);

  return (
    <span
      title={overridden ? `${description} (project override)` : description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${toneClassName(normalized)} ${className}`}
    >
      {label}
      {overridden && <span className="opacity-70">(override)</span>}
    </span>
  );
};

export default AlternativeClassBadge;

import { useState } from 'react';
import Modal from '../common/Modal';
import AlternativeClassSelect from '../common/AlternativeClassSelect';

/**
 * §V59 bulk class setter for the Library selection.
 *
 * The whole selection gets one class in a single all-or-none server call, so
 * the modal states the count it is about to change and nothing more. Rows the
 * operator may not direct-edit never reach here - Library excludes them from
 * the selection - but the server remains the authority either way.
 */
const BulkAlternativeClassModal = ({ isOpen, selectedCount, excludedCount, isPending = false, onApply, onClose }) => {
  const [altClass, setAltClass] = useState(null);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set Alternative Class"
      size="sm"
      showCloseButton={!isPending}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Cancel alternative-class update"
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(altClass)}
            disabled={selectedCount === 0 || isPending}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isPending ? 'Applying...' : `Apply to ${selectedCount} Component${selectedCount === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <AlternativeClassSelect value={altClass} onChange={setAltClass} disabled={isPending} />
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Every selected component's library default is replaced. Unrated clears the class.
      </p>
      {excludedCount > 0 && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          {excludedCount} component{excludedCount === 1 ? ' in this list is' : 's in this list are'} under
          change control and could not be selected - use an ECO to change their class.
        </p>
      )}
    </Modal>
  );
};

export default BulkAlternativeClassModal;

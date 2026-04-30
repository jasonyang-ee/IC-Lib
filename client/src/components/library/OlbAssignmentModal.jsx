import { PSPICE_SYMBOL_LABEL, SCHEMATIC_SYMBOL_LABEL } from '../../utils/cadFileTypes';

function AssignmentPanel({
  title,
  description,
  files,
  targetCategory,
  onMove,
  disableMoveToSymbol = false,
}) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 dark:border-[#3a3a3a] bg-gray-50 dark:bg-[#252525] p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      <div className="space-y-2 min-h-32">
        {files.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 dark:border-[#444444] px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            No files assigned
          </div>
        ) : files.map((file) => {
          const moveToCategory = targetCategory === 'symbol' ? 'pspice' : 'symbol';
          const moveLabel = moveToCategory === 'symbol' ? SCHEMATIC_SYMBOL_LABEL : PSPICE_SYMBOL_LABEL;
          const disabled = moveToCategory === 'symbol' && disableMoveToSymbol;

          return (
            <div
              key={file.tempFilename}
              className="rounded border border-gray-200 dark:border-[#444444] bg-white dark:bg-[#2a2a2a] px-3 py-2"
            >
              <div className="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{file.filename}</div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onMove(file.tempFilename, moveToCategory)}
                  disabled={disabled}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  Move to {moveLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OlbAssignmentModal({
  isOpen,
  assignments = [],
  isPending = false,
  onMove,
  onConfirm,
  onDiscard,
}) {
  if (!isOpen) {
    return null;
  }

  const schematicFiles = assignments.filter((file) => file.assignedCategory === 'symbol');
  const pspiceFiles = assignments.filter((file) => file.assignedCategory === 'pspice');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-4xl w-full p-6 border border-gray-200 dark:border-[#3a3a3a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assign Uploaded .olb Files</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            `.olb` can represent either a schematic symbol or a PSpice symbol. The first uploaded `.olb` defaults to schematic.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AssignmentPanel
            title={SCHEMATIC_SYMBOL_LABEL}
            description="This file stays in the Symbol library and populates the Schematic field."
            files={schematicFiles}
            targetCategory="symbol"
            onMove={onMove}
          />
          <AssignmentPanel
            title={PSPICE_SYMBOL_LABEL}
            description="This file moves into the PSpice library and appears in the PSpice section with `.lib` files."
            files={pspiceFiles}
            targetCategory="pspice"
            onMove={onMove}
            disableMoveToSymbol={schematicFiles.length > 0}
          />
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Assigning an `.olb` to Schematic may still trigger a replace confirmation if the component already has a schematic symbol linked.
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isPending}
            className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"
          >
            Discard Uploads
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Applying...' : 'Apply Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
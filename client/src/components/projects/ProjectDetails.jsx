import { FolderKanban, Plus, Edit, Download, Play } from 'lucide-react';

const ProjectDetails = ({
  selectedProject,
  projectDetails,
  canWrite,
  onEditClick,
  onGenerateBomClick,
  onConsumeAll,
  onAddComponentClick,
  onUpdateQuantity,
  onRemoveComponent,
}) => {
  if (!selectedProject) {
    return (
      <div className="lg:col-span-4 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 flex flex-col overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <FolderKanban className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">Select a project to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-4 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 flex flex-col overflow-hidden">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {projectDetails?.name || selectedProject.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {projectDetails?.description || selectedProject.description || 'No description'}
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite() && (
            <button
              onClick={onEditClick}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          <button
            onClick={onGenerateBomClick}
            disabled={!projectDetails?.components?.length}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Generate BOM
          </button>
          {canWrite() && (
            <button
              onClick={onConsumeAll}
              disabled={!projectDetails?.components?.length}
              className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
            >
              <Play className="w-4 h-4" />
              Consume All
            </button>
          )}
        </div>
      </div>

      {/* Components List */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Components ({projectDetails?.components?.length || 0})
          </h3>
          {canWrite() && (
            <button
              onClick={onAddComponentClick}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Component
            </button>
          )}
        </div>

        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
          {projectDetails?.components?.map((pc) => (
            <div
              key={pc.id}
              className="p-3 border border-gray-200 dark:border-[#3a3a3a] rounded-lg"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {pc.part_number}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {pc.manufacturer_name || pc.alt_manufacturer_name} - {pc.manufacturer_pn || pc.alt_manufacturer_pn}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm px-2 py-0.5 bg-gray-100 dark:bg-[#333333] rounded">
                      {pc.category_name}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    Value: <span className="font-medium text-gray-800 dark:text-gray-200">{pc.value || '-'}</span>
                  </span>
                  <span>
                    Part Type: <span className="font-medium text-gray-800 dark:text-gray-200">{pc.part_type || '-'}</span>
                  </span>
                  <span>
                    Package: <span className="font-medium text-gray-800 dark:text-gray-200">{pc.package_size || '-'}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-primary-700 dark:text-primary-300 font-semibold">
                      Quantity: <span>{pc.quantity}</span>
                    </span>
                    <span className={`${
                      pc.available_quantity >= pc.quantity
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      Available: <span className="font-semibold">{pc.available_quantity || 0}</span>
                    </span>
                    {pc.location && (
                      <span className="text-gray-600 dark:text-gray-400">
                        Location: {pc.location}
                      </span>
                    )}
                  </div>
                  {canWrite() && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(pc)}
                        className="btn-action-secondary"
                      >
                        Change Quantity
                      </button>
                      <button
                        onClick={() => onRemoveComponent(pc)}
                        className="btn-action-danger"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {projectDetails?.components?.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No components added yet. Click "Add Component" to start.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;

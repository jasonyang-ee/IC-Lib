import { Plus } from 'lucide-react';

const ProjectsList = ({
  projects,
  selectedProject,
  canWrite,
  onCreateClick,
  onSelectProject,
}) => {
  return (
    <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        {canWrite() && (
        <button
            onClick={onCreateClick}
            className="btn-primary flex items-center gap-2"
        >
            <Plus className="w-5 h-5" />
            New Project
        </button>
        )}
      </div>
      <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
        {projects?.map((project) => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedProject?.id === project.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{project.component_count || 0} components</span>
                  <span>Qty: {project.total_quantity || 0}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    project.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    project.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {projects?.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No projects yet. Create one to get started!
          </p>
        )}
      </div>
    </div>
  );
};

export default ProjectsList;

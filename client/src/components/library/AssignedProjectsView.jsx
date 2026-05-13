import { useNavigate } from 'react-router-dom';

const statusClassName = (status) => {
  if (status === 'active') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  }

  if (status === 'completed') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const AssignedProjectsView = ({ projects, isLoading }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-3 border border-gray-200 dark:border-[#3a3a3a]">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-lg">Projects</h3>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading project assignments...</p>
      ) : projects?.length > 0 ? (
        <div className="space-y-2">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate('/projects', { state: { projectId: project.id } })}
              className="w-full rounded-lg border border-gray-200 dark:border-[#3a3a3a] px-3 py-2 text-left transition-colors hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333333]"
              title={`Open project ${project.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline">
                  {project.name}
                </span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${statusClassName(project.status)}`}>
                  {project.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Qty: {project.total_quantity || 0}</span>
                <span>Entries: {project.assigned_item_count || 0}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Not assigned to any projects</p>
      )}
    </div>
  );
};

export default AssignedProjectsView;
// Activity type display configuration: badge colors + labels
export const activityTypeConfig = {
  // Component operations
  added: {
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-800 dark:text-green-200',
    label: 'Component Added'
  },
  updated: {
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-800 dark:text-blue-200',
    label: 'Component Updated'
  },
  deleted: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'Component Deleted'
  },
  category_changed: {
    bgColor: 'bg-violet-100 dark:bg-violet-900',
    textColor: 'text-violet-800 dark:text-violet-200',
    label: 'Category Changed'
  },

  // Inventory operations
  inventory_updated: {
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-800 dark:text-green-200',
    label: 'Quantity Updated'
  },
  inventory_consumed: {
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    textColor: 'text-orange-800 dark:text-orange-200',
    label: 'Parts Consumed'
  },
  location_updated: {
    bgColor: 'bg-purple-100 dark:bg-purple-900',
    textColor: 'text-purple-800 dark:text-purple-200',
    label: 'Location Updated'
  },

  // Alternative operations
  alternative_added: {
    bgColor: 'bg-cyan-100 dark:bg-cyan-900',
    textColor: 'text-cyan-800 dark:text-cyan-200',
    label: 'Alternative Added'
  },
  alternative_updated: {
    bgColor: 'bg-cyan-100 dark:bg-cyan-900',
    textColor: 'text-cyan-800 dark:text-cyan-200',
    label: 'Alternative Updated'
  },
  alternative_deleted: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'Alternative Deleted'
  },
  alternative_promoted: {
    bgColor: 'bg-cyan-100 dark:bg-cyan-900',
    textColor: 'text-cyan-800 dark:text-cyan-200',
    label: 'Alternative Promoted'
  },

  // Distributor operations
  distributor_updated: {
    bgColor: 'bg-indigo-100 dark:bg-indigo-900',
    textColor: 'text-indigo-800 dark:text-indigo-200',
    label: 'Distributor Updated'
  },

  // Approval operations
  approval_approved: {
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-800 dark:text-green-200',
    label: 'Approval: Approved'
  },
  approval_denied: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'Approval: Denied'
  },
  approval_sent_to_review: {
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    label: 'Sent to Review'
  },
  approval_sent_to_prototype: {
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    label: 'Sent to Prototype'
  },
  // Legacy key (kept for backward compat with old data)
  approval_changed: {
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    label: 'Approval Changed'
  },

  // Project operations
  project_created: {
    bgColor: 'bg-teal-100 dark:bg-teal-900',
    textColor: 'text-teal-800 dark:text-teal-200',
    label: 'Project Created'
  },
  project_updated: {
    bgColor: 'bg-teal-100 dark:bg-teal-900',
    textColor: 'text-teal-800 dark:text-teal-200',
    label: 'Project Updated'
  },
  project_deleted: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'Project Deleted'
  },
  component_added_to_project: {
    bgColor: 'bg-lime-100 dark:bg-lime-900',
    textColor: 'text-lime-800 dark:text-lime-200',
    label: 'Added to Project'
  },
  project_component_updated: {
    bgColor: 'bg-lime-100 dark:bg-lime-900',
    textColor: 'text-lime-800 dark:text-lime-200',
    label: 'Project Component Updated'
  },
  component_removed_from_project: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'Removed from Project'
  },

  // ECO operations
  eco_initiated: {
    bgColor: 'bg-amber-100 dark:bg-amber-900',
    textColor: 'text-amber-800 dark:text-amber-200',
    label: 'ECO Initiated'
  },
  eco_approved: {
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-800 dark:text-green-200',
    label: 'ECO Approved'
  },
  eco_rejected: {
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    label: 'ECO Rejected'
  },
  eco_stage_advanced: {
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-800 dark:text-blue-200',
    label: 'ECO Stage Advanced'
  },

  // User operations
  user_login: {
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
    label: 'User Login'
  },
  user_logout: {
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
    label: 'User Logout'
  },
};

export const defaultActivityConfig = {
  bgColor: 'bg-gray-100 dark:bg-gray-800',
  textColor: 'text-gray-700 dark:text-gray-300',
  label: 'Unknown'
};

// Activity type groupings for the filter dropdown
export const filterGroups = [
  { label: 'Components', types: ['added', 'updated', 'deleted', 'category_changed'] },
  { label: 'Inventory', types: ['inventory_updated', 'inventory_consumed', 'location_updated'] },
  { label: 'Alternatives', types: ['alternative_added', 'alternative_updated', 'alternative_deleted', 'alternative_promoted'] },
  { label: 'Distributors', types: ['distributor_updated'] },
  { label: 'Approval', types: ['approval_approved', 'approval_denied', 'approval_sent_to_review', 'approval_sent_to_prototype'] },
  { label: 'Projects', types: ['project_created', 'project_updated', 'project_deleted', 'component_added_to_project', 'project_component_updated', 'component_removed_from_project'] },
  { label: 'ECO', types: ['eco_initiated', 'eco_approved', 'eco_rejected', 'eco_stage_advanced'] },
  { label: 'Users', types: ['user_login', 'user_logout'] },
];

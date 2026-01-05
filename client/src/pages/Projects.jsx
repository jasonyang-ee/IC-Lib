import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { FolderKanban, Plus, Edit, Trash2, Save, X, Search, CheckCircle, Archive, Play, FileText, AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Projects = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const { canWrite } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [componentSearchTerm, setComponentSearchTerm] = useState('');
  const [newProject, setNewProject] = useState({ name: '', description: '', status: 'active' });
  const [bulkImportMode, setBulkImportMode] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportResults, setBulkImportResults] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showQuantityInput, setShowQuantityInput] = useState(null);
  const [quantityValue, setQuantityValue] = useState('1');

  // Fetch all projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.data;
    }
  });

  // Fetch project details with components
  const { data: projectDetails } = useQuery({
    queryKey: ['project', selectedProject?.id],
    queryFn: async () => {
      const response = await api.getProjectById(selectedProject.id);
      return response.data;
    },
    enabled: !!selectedProject
  });

  // Search components for adding to project
  const { data: searchResults } = useQuery({
    queryKey: ['componentSearch', componentSearchTerm],
    queryFn: async () => {
      const response = await api.getComponents({ search: componentSearchTerm });
      return response.data;
    },
    enabled: componentSearchTerm.length > 2
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => {
      await api.createProject(projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', status: 'active' });
    }
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await api.updateProject(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      setShowEditModal(false);
    }
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id) => {
      await api.deleteProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      setSelectedProject(null);
    }
  });

  // Add component to project
  const addComponentMutation = useMutation({
    mutationFn: async ({ projectId, component_id, quantity }) => {
      await api.addComponentToProject(projectId, { component_id, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['projects']);
      setShowAddComponentModal(false);
      setComponentSearchTerm('');
    }
  });

  // Remove component from project
  const removeComponentMutation = useMutation({
    mutationFn: async ({ projectId, componentId }) => {
      await api.removeComponentFromProject(projectId, componentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['projects']);
    }
  });

  // Update project component quantity
  const updateComponentQuantityMutation = useMutation({
    mutationFn: async ({ projectId, componentId, quantity }) => {
      await api.updateProjectComponent(projectId, componentId, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['projects']);
    }
  });

  // Consume all project components
  const consumeProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      await api.consumeProjectComponents(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['inventory']);
      showSuccess('All project components consumed successfully!');
    },
    onError: (error) => {
      showError('Error consuming components: ' + (error.response?.data?.error || error.message));
    }
  });

  const handleCreateProject = () => {
    if (!newProject.name.trim()) {
      showError('Please enter a project name');
      return;
    }
    createProjectMutation.mutate(newProject);
  };

  const handleUpdateProject = () => {
    if (!selectedProject) return;
    updateProjectMutation.mutate({
      id: selectedProject.id,
      data: selectedProject
    });
  };

  const handleDeleteProject = (project) => {
    setShowDeleteConfirm(project);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteProjectMutation.mutate(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
  };

  const handleAddComponent = (component) => {
    if (!selectedProject) return;
    setShowQuantityInput(component);
    setQuantityValue('1');
  };

  const confirmAddComponent = () => {
    if (!showQuantityInput || !selectedProject) return;
    const qty = parseInt(quantityValue);
    if (qty && qty > 0) {
      addComponentMutation.mutate({
        projectId: selectedProject.id,
        component_id: showQuantityInput.id,
        quantity: qty
      });
      setShowQuantityInput(null);
      setQuantityValue('1');
    } else {
      showError('Please enter a valid quantity');
    }
  };

  const handleBulkImportSearch = async () => {
    if (!bulkImportText.trim()) return;
    
    // Split by newlines and filter empty lines
    const partNumbers = bulkImportText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (partNumbers.length === 0) {
      showError('Please enter at least one part number');
      return;
    }
    
    try {
      // Search for each part number
      const promises = partNumbers.map(async (pn) => {
        try {
          const response = await api.getComponents({ search: pn });
          const components = response.data;
          // Find exact or close match by manufacturer_pn
          const match = components.find(c => 
            c.manufacturer_pn?.toLowerCase() === pn.toLowerCase()
          ) || components[0]; // Take first result if no exact match
          
          return {
            searchTerm: pn,
            found: !!match,
            component: match,
            quantity: 1 // Default quantity
          };
        } catch {
          return {
            searchTerm: pn,
            found: false,
            component: null,
            quantity: 1
          };
        }
      });
      
      const results = await Promise.all(promises);
      setBulkImportResults(results);
    } catch (error) {
      showError('Error searching for components: ' + error.message);
    }
  };

  const handleBulkImportAdd = async () => {
    const toAdd = bulkImportResults.filter(r => r.found && r.quantity > 0);
    
    if (toAdd.length === 0) {
      showError('No valid components to add');
      return;
    }
    
    try {
      let successCount = 0;
      let duplicateCount = 0;
      const errors = [];
      
      // Add all components
      for (const item of toAdd) {
        try {
          await api.addComponentToProject(selectedProject.id, {
            component_id: item.component.id,
            quantity: item.quantity
          });
          successCount++;
        } catch (error) {
          // Check if it's a duplicate error
          if (error.response?.status === 409 || 
              error.response?.data?.error?.toLowerCase().includes('already') ||
              error.response?.data?.error?.toLowerCase().includes('duplicate')) {
            duplicateCount++;
          } else {
            errors.push(`${item.mfgPn}: ${error.message}`);
          }
        }
      }
      
      // Refresh project data
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['projects']);
      
      // Close modal and reset
      setShowAddComponentModal(false);
      setBulkImportMode(false);
      setBulkImportText('');
      setBulkImportResults([]);
      
      // Show results
      if (successCount > 0) {
        showSuccess(`Successfully added ${successCount} component(s) to project${duplicateCount > 0 ? ` (${duplicateCount} skipped as duplicates)` : ''}`);
      }
      if (errors.length > 0) {
        showError(`Errors: ${errors.join(', ')}`);
      }
    } catch (error) {
      alert('Error adding components: ' + error.message);
    }
  };

  // Export project to CSV with all details
  const handleExportProject = async () => {
    if (!selectedProject || !projectDetails) return;

    try {
      // Fetch detailed information for each component including alternatives and distributors
      const detailedComponents = await Promise.all(
        projectDetails.components.map(async (pc) => {
          try {
            // Fetch component alternatives and distributors
            const componentId = pc.component_id || pc.alternative_id;
            const alternativesRes = await api.getComponentAlternatives(componentId);
            const alternatives = alternativesRes.data || [];

            // Get distributor info for primary component
            let distributors = [];
            if (pc.component_id) {
              try {
                const compRes = await api.getComponentById(pc.component_id);
                distributors = compRes.data.distributors || [];
              } catch (err) {
                console.error('Error fetching distributors:', err);
              }
            }

            return {
              part_number: pc.part_number,
              manufacturer: pc.manufacturer_name || pc.alt_manufacturer_name,
              manufacturer_pn: pc.manufacturer_pn || pc.alt_manufacturer_pn,
              description: pc.description,
              category: pc.category_name,
              quantity_needed: pc.quantity,
              available_quantity: pc.available_quantity || 0,
              location: pc.location || '',
              value: pc.value || '',
              alternatives: alternatives,
              distributors: distributors
            };
          } catch (error) {
            console.error('Error fetching component details:', error);
            return {
              part_number: pc.part_number,
              manufacturer: pc.manufacturer_name || pc.alt_manufacturer_name,
              manufacturer_pn: pc.manufacturer_pn || pc.alt_manufacturer_pn,
              description: pc.description,
              category: pc.category_name,
              quantity_needed: pc.quantity,
              available_quantity: pc.available_quantity || 0,
              location: pc.location || '',
              value: pc.value || '',
              alternatives: [],
              distributors: []
            };
          }
        })
      );

      // Build CSV content
      const headers = [
        'Part Number',
        'Manufacturer',
        'Manufacturer P/N',
        'Description',
        'Category',
        'Value',
        'Quantity Needed',
        'Available',
        'Location',
        'Distributors',
        'Alternative Parts'
      ];

      const rows = detailedComponents.map(comp => {
        const distInfo = comp.distributors
          .map(d => `${d.distributor_name}: ${d.distributor_pn} ($${d.price || 'N/A'})`)
          .join('; ');

        const altInfo = comp.alternatives
          .map(a => `${a.manufacturer_name} ${a.manufacturer_pn}`)
          .join('; ');

        return [
          comp.part_number,
          comp.manufacturer,
          comp.manufacturer_pn,
          `"${(comp.description || '').replace(/"/g, '""')}"`,
          comp.category,
          comp.value,
          comp.quantity_needed,
          comp.available_quantity,
          comp.location,
          `"${distInfo.replace(/"/g, '""')}"`,
          `"${altInfo.replace(/"/g, '""')}"`
        ];
      });

      const csvContent = [
        `Project: ${selectedProject.name}`,
        `Status: ${selectedProject.status}`,
        `Description: ${selectedProject.description || 'N/A'}`,
        `Exported: ${new Date().toLocaleString()}`,
        '',
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedProject.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('Project exported successfully!');
    } catch (error) {
      console.error('Error exporting project:', error);
      showError('Failed to export project: ' + error.message);
    }
  };

  const updateBulkImportQuantity = (index, quantity) => {
    const updated = [...bulkImportResults];
    updated[index].quantity = parseInt(quantity) || 0;
    setBulkImportResults(updated);
  };

  const handleUpdateQuantity = (projectComponent) => {
    const newQty = prompt('Enter new quantity:', projectComponent.quantity.toString());
    if (newQty && parseInt(newQty) > 0) {
      updateComponentQuantityMutation.mutate({
        projectId: selectedProject.id,
        componentId: projectComponent.id,
        quantity: parseInt(newQty)
      });
    }
  };

  const handleRemoveComponent = (projectComponent) => {
    if (confirm('Remove this component from the project?')) {
      removeComponentMutation.mutate({
        projectId: selectedProject.id,
        componentId: projectComponent.id
      });
    }
  };

  const handleConsumeAll = () => {
    if (!selectedProject) return;
    if (confirm(`This will consume all components for project "${selectedProject.name}" from inventory. Continue?`)) {
      consumeProjectMutation.mutate(selectedProject.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FolderKanban className="w-8 h-8" />
          Projects
        </h1>
        {canWrite() && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Projects List */}
        <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 shrink-0">
            All Projects ({projects?.length || 0})
          </h2>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {projects?.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedProject?.id === project.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                  {canWrite() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project);
                      }}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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

        {/* Project Details */}
        <div className="lg:col-span-2 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 flex flex-col overflow-hidden">
          {selectedProject ? (
            <>
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
                      onClick={() => setShowEditModal(true)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleExportProject}
                    disabled={!projectDetails?.components?.length}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  {canWrite() && (
                    <button
                      onClick={handleConsumeAll}
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
                      onClick={() => setShowAddComponentModal(true)}
                      className="btn-secondary flex items-center gap-2"
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
                      className="p-4 border border-gray-200 dark:border-[#3a3a3a] rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {pc.part_number}
                            </span>
                            <span className="text-sm px-2 py-0.5 bg-gray-100 dark:bg-[#333333] rounded">
                              {pc.category_name}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {pc.manufacturer_name} - {pc.manufacturer_pn || pc.alt_manufacturer_pn}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                            {pc.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              Needed: <span className="font-semibold">{pc.quantity}</span>
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
                        </div>
                        {canWrite() && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateQuantity(pc)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Update quantity"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveComponent(pc)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              title="Remove component"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <FolderKanban className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select a project to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New Project
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProject({ name: '', description: '', status: 'active' });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Edit Project
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={selectedProject.name}
                  onChange={(e) => setSelectedProject({ ...selectedProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedProject.description || ''}
                  onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={selectedProject.status}
                  onChange={(e) => setSelectedProject({ ...selectedProject, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProject}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddComponentModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddComponentModal(false);
              setBulkImportMode(false);
              setBulkImportText('');
              setBulkImportResults([]);
              setComponentSearchTerm('');
            }
          }}
        >
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Add Component to Project
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBulkImportMode(!bulkImportMode);
                    setBulkImportText('');
                    setBulkImportResults([]);
                    setComponentSearchTerm('');
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    bulkImportMode
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#444444]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Bulk Import
                </button>
              </div>
            </div>

            {!bulkImportMode ? (
              <>
                {/* Single Component Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={componentSearchTerm}
                      onChange={(e) => setComponentSearchTerm(e.target.value)}
                      placeholder="Search components by part number, MFG P/N, or description..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {searchResults?.map((component) => (
                    <div
                      key={component.id}
                      onClick={() => handleAddComponent(component)}
                      className="p-3 border border-gray-200 dark:border-[#3a3a3a] rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {component.part_number}
                          </span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {component.manufacturer_name} - {component.manufacturer_pn}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                            {component.description}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-[#333333] rounded">
                          {component.category_name}
                        </span>
                      </div>
                    </div>
                  ))}
                  {componentSearchTerm.length > 2 && searchResults?.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No components found matching "{componentSearchTerm}"
                    </p>
                  )}
                  {componentSearchTerm.length <= 2 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Type at least 3 characters to search
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Bulk Import Mode */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Paste MFG Part Numbers (one per line)
                  </label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="Example:&#10;TPS54360BDDAR&#10;LM358DR&#10;SN74HC595DR"
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 font-mono text-sm"
                  />
                  <button
                    onClick={handleBulkImportSearch}
                    disabled={!bulkImportText.trim()}
                    className="mt-2 btn-primary disabled:bg-gray-400"
                  >
                    Search All
                  </button>
                </div>

                {bulkImportResults.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Results ({bulkImportResults.filter(r => r.found).length} of {bulkImportResults.length} found)
                    </h4>
                    {bulkImportResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 border rounded-lg ${
                          result.found
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                            : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        {result.found ? (
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                                {result.searchTerm}
                              </span>
                              <p className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                                {result.component.part_number}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {result.component.manufacturer_name} - {result.component.manufacturer_pn}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-gray-600 dark:text-gray-400">Qty:</label>
                              <input
                                type="number"
                                min="1"
                                value={result.quantity}
                                onChange={(e) => updateBulkImportQuantity(index, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-center focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-red-600" />
                            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                              {result.searchTerm}
                            </span>
                            <span className="text-sm text-red-600 dark:text-red-400">- Not found</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {bulkImportMode && bulkImportResults.length > 0 && (
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handleBulkImportAdd}
                  disabled={!bulkImportResults.some(r => r.found && r.quantity > 0)}
                  className="btn-primary disabled:bg-gray-400"
                >
                  Add {bulkImportResults.filter(r => r.found && r.quantity > 0).length} Components
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Project
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete project "<strong>{showDeleteConfirm.name}</strong>"? 
              This will remove all component associations.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Input Modal */}
      {showQuantityInput && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuantityInput(null);
              setQuantityValue('1');
            }
          }}
        >
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Add Component to Project
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>{showQuantityInput.part_number}</strong>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {showQuantityInput.manufacturer_name} - {showQuantityInput.manufacturer_pn}
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantity Needed:
              </label>
              <input
                type="number"
                min="1"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmAddComponent();
                  } else if (e.key === 'Escape') {
                    setShowQuantityInput(null);
                    setQuantityValue('1');
                  }
                }}
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowQuantityInput(null);
                  setQuantityValue('1');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddComponent}
                className="btn-primary"
              >
                Add to Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;

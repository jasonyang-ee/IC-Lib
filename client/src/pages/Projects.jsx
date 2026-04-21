import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectsList, ProjectDetails, ProjectModals } from '../components/projects';

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
      const response = await api.consumeProjectComponents(projectId);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['project', selectedProject?.id]);
      queryClient.invalidateQueries(['inventory']);
      showSuccess(data?.message || 'All project components consumed successfully!');
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      showError('Error consuming components: ' + message);
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

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewProject({ name: '', description: '', status: 'active' });
  };

  const handleCloseAddComponentModal = () => {
    setShowAddComponentModal(false);
    setBulkImportMode(false);
    setBulkImportText('');
    setBulkImportResults([]);
    setComponentSearchTerm('');
  };

  const handleCancelQuantityInput = () => {
    setShowQuantityInput(null);
    setQuantityValue('1');
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 overflow-hidden">
        <ProjectsList
          projects={projects}
          selectedProject={selectedProject}
          canWrite={canWrite}
          onCreateClick={() => setShowCreateModal(true)}
          onSelectProject={handleSelectProject}
          onDeleteProject={handleDeleteProject}
        />

        <ProjectDetails
          selectedProject={selectedProject}
          projectDetails={projectDetails}
          canWrite={canWrite}
          onEditClick={() => setShowEditModal(true)}
          onExportProject={handleExportProject}
          onConsumeAll={handleConsumeAll}
          onAddComponentClick={() => setShowAddComponentModal(true)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveComponent={handleRemoveComponent}
        />
      </div>

      <ProjectModals
        showCreateModal={showCreateModal}
        newProject={newProject}
        setNewProject={setNewProject}
        onCreateProject={handleCreateProject}
        onCloseCreateModal={handleCloseCreateModal}
        showEditModal={showEditModal}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        onUpdateProject={handleUpdateProject}
        onCloseEditModal={() => setShowEditModal(false)}
        showAddComponentModal={showAddComponentModal}
        componentSearchTerm={componentSearchTerm}
        setComponentSearchTerm={setComponentSearchTerm}
        searchResults={searchResults}
        bulkImportMode={bulkImportMode}
        setBulkImportMode={setBulkImportMode}
        bulkImportText={bulkImportText}
        setBulkImportText={setBulkImportText}
        bulkImportResults={bulkImportResults}
        onBulkImportSearch={handleBulkImportSearch}
        onBulkImportAdd={handleBulkImportAdd}
        onAddComponent={handleAddComponent}
        updateBulkImportQuantity={updateBulkImportQuantity}
        onCloseAddComponentModal={handleCloseAddComponentModal}
        showDeleteConfirm={showDeleteConfirm}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => setShowDeleteConfirm(null)}
        showQuantityInput={showQuantityInput}
        quantityValue={quantityValue}
        setQuantityValue={setQuantityValue}
        onConfirmAddComponent={confirmAddComponent}
        onCancelQuantityInput={handleCancelQuantityInput}
      />
    </div>
  );
};

export default Projects;

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmationModal } from '../components/common';
import { ProjectsList, ProjectDetails, ProjectModals } from '../components/projects';
import {
  BOM_COLUMN_DEFINITIONS,
  buildBomCsvContent,
  buildBomFileName,
  DEFAULT_BOM_COLUMN_IDS,
  sanitizeBomColumnIds,
} from '../utils/bomExport';

const getResponseData = async (request, fallbackValue) => {
  try {
    const response = await request;
    return response.data;
  } catch {
    return fallbackValue;
  }
};

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
  const [showBomModal, setShowBomModal] = useState(false);
  const [selectedBomColumnIds, setSelectedBomColumnIds] = useState([...DEFAULT_BOM_COLUMN_IDS]);
  const [isGeneratingBom, setIsGeneratingBom] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

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

  const { data: appSettings } = useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const response = await api.getSettings();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const defaultBomColumnIds = useMemo(
    () => sanitizeBomColumnIds(appSettings?.bomDefaults?.columnIds),
    [appSettings?.bomDefaults?.columnIds],
  );

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
      setShowDeleteConfirm(null);
    },
    onError: (error) => {
      showError('Error deleting project: ' + (error.response?.data?.error || error.message));
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
    },
    onError: (error) => {
      showError('Error removing component: ' + (error.response?.data?.error || error.message));
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
    },
    onError: (error) => {
      showError('Error updating quantity: ' + (error.response?.data?.error || error.message));
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
    }
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
  };

  const handleAddComponent = (component) => {
    if (!selectedProject) return;
    setShowQuantityInput({
      ...component,
      mode: 'add',
    });
    setQuantityValue('1');
  };

  const confirmQuantityInput = () => {
    if (!showQuantityInput || !selectedProject) return;
    const qty = parseInt(quantityValue, 10);
    if (qty && qty > 0) {
      if (showQuantityInput.mode === 'update') {
        updateComponentQuantityMutation.mutate({
          projectId: selectedProject.id,
          componentId: showQuantityInput.id,
          quantity: qty,
        });
      } else {
        addComponentMutation.mutate({
          projectId: selectedProject.id,
          component_id: showQuantityInput.id,
          quantity: qty
        });
      }

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
            errors.push(`${item.searchTerm}: ${error.message}`);
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
      showError('Error adding components: ' + error.message);
    }
  };

  const handleOpenBomModal = () => {
    if (!selectedProject || !projectDetails?.components?.length) {
      return;
    }

    setSelectedBomColumnIds([...defaultBomColumnIds]);
    setShowBomModal(true);
  };

  const handleGenerateBom = async () => {
    if (!selectedProject || !projectDetails?.components?.length) {
      return;
    }

    if (selectedBomColumnIds.length === 0) {
      showError('Select at least one BOM column');
      return;
    }

    setIsGeneratingBom(true);

    try {
      const detailedComponents = await Promise.all(
        projectDetails.components.map(async (projectComponent) => {
          const componentDetails = projectComponent.component_id
            ? await getResponseData(api.getComponentById(projectComponent.component_id), null)
            : null;
          const distributors = projectComponent.component_id
            ? await getResponseData(api.getComponentDistributors(projectComponent.component_id), [])
            : [];
          const alternatives = projectComponent.component_id
            ? await getResponseData(api.getComponentAlternatives(projectComponent.component_id), [])
            : [];

          return {
            part_number: projectComponent.part_number || componentDetails?.part_number || '',
            manufacturer: projectComponent.manufacturer_name || projectComponent.alt_manufacturer_name || componentDetails?.manufacturer_name || '',
            manufacturer_pn: projectComponent.manufacturer_pn || projectComponent.alt_manufacturer_pn || componentDetails?.manufacturer_pn || '',
            description: projectComponent.description || componentDetails?.description || '',
            category: projectComponent.category_name || componentDetails?.category_name || '',
            value: projectComponent.value || componentDetails?.value || '',
            quantity: projectComponent.quantity,
            available_quantity: projectComponent.available_quantity || 0,
            location: projectComponent.location || '',
            approval_status: componentDetails?.approval_status || '',
            status: selectedProject.status,
            part_type: componentDetails?.part_type || '',
            package_size: componentDetails?.package_size || '',
            datasheet_url: componentDetails?.datasheet_url || '',
            sub_category1: componentDetails?.sub_category1 || '',
            sub_category2: componentDetails?.sub_category2 || '',
            sub_category3: componentDetails?.sub_category3 || '',
            sub_category4: componentDetails?.sub_category4 || '',
            notes: projectComponent.notes || '',
            created_at: componentDetails?.created_at || '',
            pcb_footprint: componentDetails?.pcb_footprint || [],
            schematic: componentDetails?.schematic || [],
            step_model: componentDetails?.step_model || [],
            pspice: componentDetails?.pspice || [],
            pad_file: componentDetails?.pad_file || [],
            distributors,
            alternatives,
          };
        }),
      );

      const csvContent = buildBomCsvContent({
        project: {
          name: projectDetails?.name || selectedProject.name,
          status: projectDetails?.status || selectedProject.status,
          description: projectDetails?.description || selectedProject.description,
        },
        components: detailedComponents,
        selectedColumnIds: selectedBomColumnIds,
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', buildBomFileName(projectDetails?.name || selectedProject.name));
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowBomModal(false);
      showSuccess('BOM generated successfully!');
    } catch (error) {
      showError('Failed to generate BOM: ' + error.message);
    } finally {
      setIsGeneratingBom(false);
    }
  };

  const updateBulkImportQuantity = (index, quantity) => {
    const updated = [...bulkImportResults];
    updated[index].quantity = parseInt(quantity) || 0;
    setBulkImportResults(updated);
  };

  const handleUpdateQuantity = (projectComponent) => {
    setShowQuantityInput({
      ...projectComponent,
      mode: 'update',
    });
    setQuantityValue(projectComponent.quantity.toString());
  };

  const handleRemoveComponent = (projectComponent) => {
    setConfirmAction({
      type: 'remove-component',
      payload: projectComponent,
      title: 'Remove Component',
      message: `Remove ${projectComponent.part_number} from this project?`,
      confirmText: 'Remove Component',
      confirmStyle: 'danger',
    });
  };

  const handleConsumeAll = () => {
    if (!selectedProject) return;

    setConfirmAction({
      type: 'consume-all',
      payload: selectedProject,
      title: 'Consume All Components',
      message: `This will consume all components for project "${selectedProject.name}" from inventory. Continue?`,
      confirmText: 'Consume All',
      confirmStyle: 'primary',
    });
  };

  const handleToggleBomColumn = (columnId) => {
    setSelectedBomColumnIds((current) => (
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
    ));
  };

  const handleSelectAllBomColumns = () => {
    setSelectedBomColumnIds(BOM_COLUMN_DEFINITIONS.map((column) => column.id));
  };

  const handleResetBomColumns = () => {
    setSelectedBomColumnIds([...defaultBomColumnIds]);
  };

  const handleConfirmAction = () => {
    if (!confirmAction || !selectedProject) {
      return;
    }

    if (confirmAction.type === 'remove-component') {
      removeComponentMutation.mutate({
        projectId: selectedProject.id,
        componentId: confirmAction.payload.id,
      });
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'consume-all') {
      consumeProjectMutation.mutate(selectedProject.id);
      setConfirmAction(null);
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
          onGenerateBomClick={handleOpenBomModal}
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
        onConfirmQuantityInput={confirmQuantityInput}
        onCancelQuantityInput={handleCancelQuantityInput}
        showBomModal={showBomModal}
        bomColumnOptions={BOM_COLUMN_DEFINITIONS}
        selectedBomColumnIds={selectedBomColumnIds}
        onToggleBomColumn={handleToggleBomColumn}
        onSelectAllBomColumns={handleSelectAllBomColumns}
        onResetBomColumns={handleResetBomColumns}
        onConfirmGenerateBom={handleGenerateBom}
        onCloseBomModal={() => setShowBomModal(false)}
        isGeneratingBom={isGeneratingBom}
      />

      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction?.title || 'Confirm Action'}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || 'Confirm'}
        confirmStyle={confirmAction?.confirmStyle || 'primary'}
      />
    </div>
  );
};

export default Projects;

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ProjectModals from '../components/projects/ProjectModals';
import ProjectDetails from '../components/projects/ProjectDetails';

// §V48/§V59: a project BOM line may override the component's library default.
// Blank means "use the library default"; the row shows the resolved class and
// says when it came from an override. Consume All shows a Class A / Unrated
// advisory but stays ungated.

const modalProps = (overrides = {}) => ({
  showCreateModal: false,
  showEditModal: false,
  showAddComponentModal: false,
  showDeleteConfirm: null,
  showBomModal: false,
  newProject: { name: '', description: '', status: 'active' },
  searchResults: [],
  bulkImportResults: [],
  bomColumnOptions: [],
  selectedBomColumnIds: [],
  setNewProject: vi.fn(),
  setComponentSearchTerm: vi.fn(),
  setBulkImportMode: vi.fn(),
  setBulkImportText: vi.fn(),
  setQuantityValue: vi.fn(),
  setAltClassValue: vi.fn(),
  updateBulkImportQuantity: vi.fn(),
  updateBulkImportAltClass: vi.fn(),
  onCreateProject: vi.fn(),
  onUpdateProject: vi.fn(),
  onCloseCreateModal: vi.fn(),
  onCloseEditModal: vi.fn(),
  onBulkImportSearch: vi.fn(),
  onBulkImportAdd: vi.fn(),
  onAddComponent: vi.fn(),
  onCloseAddComponentModal: vi.fn(),
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onConfirmQuantityInput: vi.fn(),
  onCancelQuantityInput: vi.fn(),
  onToggleBomColumn: vi.fn(),
  onSelectAllBomColumns: vi.fn(),
  onResetBomColumns: vi.fn(),
  onConfirmGenerateBom: vi.fn(),
  onCloseBomModal: vi.fn(),
  isGeneratingBom: false,
  ...overrides,
});

describe('project line override modal (§V59)', () => {
  const openQuantityModal = (extra = {}) => {
    const setAltClassValue = vi.fn();
    render(
      <ProjectModals
        {...modalProps({
          showQuantityInput: { id: 'pc1', mode: 'update', part_number: 'IC-00001', quantity: 4 },
          quantityValue: '4',
          altClassValue: null,
          setAltClassValue,
          ...extra,
        })}
      />,
    );
    return setAltClassValue;
  };

  it('offers "Use library default" instead of Unrated for the override', () => {
    openQuantityModal();

    expect(screen.getByLabelText('Alternative Class Override')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Use library default' })).toBeInTheDocument();
  });

  it('shows an existing override', () => {
    openQuantityModal({ altClassValue: 'B' });

    expect(screen.getByLabelText('Alternative Class Override')).toHaveValue('B');
  });

  it('reports the letter when an override is chosen', () => {
    const setAltClassValue = openQuantityModal();

    fireEvent.change(screen.getByLabelText('Alternative Class Override'), { target: { value: 'A' } });

    expect(setAltClassValue).toHaveBeenCalledWith('A');
  });

  it('reports null when the override is cleared back to the library default', () => {
    const setAltClassValue = openQuantityModal({ altClassValue: 'A' });

    fireEvent.change(screen.getByLabelText('Alternative Class Override'), { target: { value: '' } });

    expect(setAltClassValue).toHaveBeenCalledWith(null);
  });

  it('offers a per-row override on bulk import', () => {
    const updateBulkImportAltClass = vi.fn();
    render(
      <ProjectModals
        {...modalProps({
          showAddComponentModal: true,
          bulkImportMode: true,
          bulkImportText: 'MPN-1',
          bulkImportResults: [{
            searchTerm: 'MPN-1',
            found: true,
            quantity: 2,
            component: { id: 'c1', part_number: 'IC-00001', manufacturer_name: 'TI', manufacturer_pn: 'MPN-1' },
          }],
          showQuantityInput: null,
          quantityValue: '1',
          altClassValue: null,
          updateBulkImportAltClass,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'C' } });

    expect(updateBulkImportAltClass).toHaveBeenCalledWith(0, 'C');
  });
});

describe('project row class display (§V48/§V59)', () => {
  const renderDetails = (components) => render(
    <MemoryRouter>
      <ProjectDetails
        selectedProject={{ id: 'p1', name: 'Board' }}
        projectDetails={{ name: 'Board', components }}
        canWrite={() => true}
        onEditClick={vi.fn()}
        onGenerateBomClick={vi.fn()}
        onConsumeAll={vi.fn()}
        onAddComponentClick={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveComponent={vi.fn()}
      />
    </MemoryRouter>,
  );

  it('shows the class inherited from the component default without an override mark', () => {
    renderDetails([
      { id: 'pc1', part_number: 'IC-00001', quantity: 1, alt_class: null, component_alt_class: 'B', resolved_alt_class: 'B' },
    ]);

    expect(screen.getByText('Class B')).toBeInTheDocument();
    expect(screen.queryByText('(override)')).not.toBeInTheDocument();
  });

  it('marks a line whose own override produced the class', () => {
    renderDetails([
      { id: 'pc1', part_number: 'IC-00001', quantity: 1, alt_class: 'A', component_alt_class: 'C', resolved_alt_class: 'A' },
    ]);

    expect(screen.getByText('Class A')).toBeInTheDocument();
    expect(screen.getByText('(override)')).toBeInTheDocument();
  });

  it('shows Unrated when neither the line nor the component is rated', () => {
    renderDetails([
      { id: 'pc1', part_number: 'IC-00001', quantity: 1, alt_class: null, component_alt_class: null, resolved_alt_class: null },
    ]);

    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });
});

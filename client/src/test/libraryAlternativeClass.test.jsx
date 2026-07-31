import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import BulkAlternativeClassModal from '../components/library/BulkAlternativeClassModal';
import ComponentEditForm from '../components/library/ComponentEditForm';
import ComponentDetailView from '../components/library/ComponentDetailView';
import { canBulkSetAlternativeClass } from '../utils/accessControl';

// The edit form embeds the CAD file manager, which pulls in the query client,
// notifications and upload endpoints. None of that is under test here.
vi.mock('../components/library/ComponentFiles', () => ({ default: () => null }));

// §V41/§V59: the Library carries the component's library default - a field in
// add/edit, a badge in the detail view, and one all-or-none bulk set over the
// current selection. With ECO on, a non-admin may only include parts they
// could direct-edit (§V15); the server stays the authority either way.

describe('bulk class selection eligibility (§V15/§V59)', () => {
  it('lets any write role include any part when ECO is off', () => {
    expect(canBulkSetAlternativeClass('read-write', 'production', false)).toBe(true);
    expect(canBulkSetAlternativeClass('read-write', 'new', false)).toBe(true);
  });

  it('lets an admin include a controlled part when ECO is on', () => {
    expect(canBulkSetAlternativeClass('admin', 'production', true)).toBe(true);
    expect(canBulkSetAlternativeClass('admin', 'archived', true)).toBe(true);
  });

  it('limits a non-admin to new parts when ECO is on', () => {
    expect(canBulkSetAlternativeClass('read-write', 'new', true)).toBe(true);
    expect(canBulkSetAlternativeClass('read-write', 'production', true)).toBe(false);
    expect(canBulkSetAlternativeClass('read-write', 'reviewing', true)).toBe(false);
    expect(canBulkSetAlternativeClass('read-only', 'new', true)).toBe(false);
  });
});

describe('BulkAlternativeClassModal (§V59)', () => {
  const renderModal = (props = {}) => render(
    <BulkAlternativeClassModal
      isOpen
      selectedCount={3}
      excludedCount={0}
      onApply={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

  it('names the number of components the change will touch', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Apply to 3 Components' })).toBeEnabled();
  });

  it('applies the chosen class in one call', () => {
    const onApply = vi.fn();
    renderModal({ onApply });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 3 Components' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('B');
  });

  it('clears the class by applying null, never an empty string', () => {
    const onApply = vi.fn();
    renderModal({ onApply });

    fireEvent.click(screen.getByRole('button', { name: 'Apply to 3 Components' }));

    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('cannot be applied with nothing selected', () => {
    const onApply = vi.fn();
    renderModal({ selectedCount: 0, onApply });

    expect(screen.getByRole('button', { name: 'Apply to 0 Components' })).toBeDisabled();
  });

  it('closes without applying on cancel', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderModal({ onApply, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('says which parts were held back for an ECO', () => {
    renderModal({ excludedCount: 2 });

    expect(screen.getByText(/2 components in this list are under change control/)).toBeInTheDocument();
    expect(screen.getByText(/use an ECO/)).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    const { container } = renderModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('ComponentEditForm alternative class (§V41)', () => {
  const mountForm = (editData) => {
    const onFieldChange = vi.fn();
    render(
      <ComponentEditForm
        editData={editData}
        isAddMode
        isEditMode={false}
        categories={[]}
        manufacturers={[]}
        onFieldChange={onFieldChange}
        manufacturerInput=""
        setManufacturerInput={vi.fn()}
        manufacturerOpen={false}
        setManufacturerOpen={vi.fn()}
        packageSuggestions={[]}
        packageOpen={false}
        setPackageOpen={vi.fn()}
        subCat1Suggestions={[]}
        subCat2Suggestions={[]}
        subCat3Suggestions={[]}
        subCat4Suggestions={[]}
        setEditData={vi.fn()}
      />,
    );
    return onFieldChange;
  };

  it('shows the stored class for the part being edited', () => {
    mountForm({ alt_class: 'C' });

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('C');
  });

  it('defaults a new part to Unrated', () => {
    mountForm({ alt_class: null });

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('');
  });

  it('sends the letter when a class is picked', () => {
    const onFieldChange = mountForm({ alt_class: null });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: 'A' } });

    expect(onFieldChange).toHaveBeenCalledWith('alt_class', 'A');
  });

  it('sends null when the class is cleared back to Unrated', () => {
    const onFieldChange = mountForm({ alt_class: 'A' });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: '' } });

    expect(onFieldChange).toHaveBeenCalledWith('alt_class', null);
  });
});

describe('ComponentDetailView alternative class (§V41)', () => {
  const renderDetail = (altClass) => render(
    <MemoryRouter>
      <ComponentDetailView
        componentDetails={{ id: 'c1', part_number: 'IC-00001', alt_class: altClass }}
        selectedComponent={{ id: 'c1' }}
        alternatives={[]}
        selectedAlternative={null}
        setSelectedAlternative={vi.fn()}
        onCopy={vi.fn()}
        canAccessFileLibrary={false}
        canApprove={() => false}
        canWrite={() => false}
        updatingApproval={false}
        onApprovalAction={vi.fn()}
      />
    </MemoryRouter>,
  );

  it('shows the rated class with its substitution rule', () => {
    renderDetail('B');

    expect(screen.getByText('Alternative Class:')).toBeInTheDocument();
    expect(screen.getByTitle('Substitute per drawing notes.')).toHaveTextContent('Class B');
  });

  it('shows Unrated rather than a blank when the part has no class', () => {
    renderDetail(null);

    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CadFieldSection from '../components/library/CadFieldSection';
import CategoryView from '../components/fileLibrary/CategoryView';
import ComponentDetailView from '../components/library/ComponentDetailView';
import FileTypesView from '../components/fileLibrary/FileTypesView';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }) => ({
    getTotalSize: () => count * 45,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 45, key: index })),
    measureElement: () => {},
  }),
}));

// F1.T1 ruled these five expressions in: they are read surfaces. Each assertion
// pairs the uppercase display form with proof that the stored lowercase name is
// what still reaches a handler, a link target, or a copy-path call (SPEC V63).
describe('footprint display case at the adopted render sites', () => {
  it('CadFieldSection shows the footprint base uppercase and leaves a symbol alone', () => {
    const { rerender } = render(<CadFieldSection field="pcb_footprint" values={['max17761atp']} />);
    expect(screen.getByText('MAX17761ATP')).toBeInTheDocument();

    rerender(<CadFieldSection field="schematic" values={['Op_Amp_Dual']} />);
    expect(screen.getByText('Op_Amp_Dual')).toBeInTheDocument();
  });

  it('ComponentDetailView shows the footprint uppercase but navigates with the stored name', () => {
    navigateMock.mockClear();
    render(
      <ComponentDetailView
        selectedComponent={{ id: 'component-1' }}
        componentDetails={{ part_number: 'RES-00001', pcb_footprint: 'dip-8_a', schematic: 'Sensor_Sym' }}
        canAccessFileLibrary
        onCopy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'DIP-8_A' }));
    expect(navigateMock).toHaveBeenCalledWith('/file-library?type=footprint&file=dip-8_a');
    expect(screen.getByRole('button', { name: 'Sensor_Sym' })).toBeInTheDocument();
  });

  it('CategoryView shows the footprint uppercase but renames and copies the stored name', () => {
    const onOpenRename = vi.fn();
    const onCopyPath = vi.fn();

    render(
      <CategoryView
        categories={[]}
        selectedCategoryId="all"
        selectedComponentId="component-1"
        categoryComponents={{ components: [{ id: 'component-1', part_number: 'RES-00001' }] }}
        componentFiles={{ files: { footprint: [{ id: 'file-1', file_name: 'max17761atp.psm', file_type: 'footprint' }] } }}
        sharingData={null}
        searchQuery=""
        onCategoryChange={vi.fn()}
        onComponentSelect={vi.fn()}
        onOpenRename={onOpenRename}
        onCopyPath={onCopyPath}
        canWrite={() => true}
        navigate={vi.fn()}
      />,
    );

    expect(screen.getByText('MAX17761ATP.psm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy File Path' }));
    expect(onCopyPath).toHaveBeenCalledWith('max17761atp.psm', 'footprint');

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onOpenRename).toHaveBeenCalledWith('max17761atp.psm', 'footprint');
  });

  it('FileTypesView shows a footprint pair uppercase but copies the stored names', () => {
    const onCopyPath = vi.fn();
    const onSelectFile = vi.fn();
    const pairEntry = {
      key: 'pair:soic-8_b',
      kind: 'pair',
      displayName: 'soic-8_b',
      file_type: 'footprint',
      fileNames: ['soic-8_b.dra', 'soic-8_b.psm'],
      files: [
        { file_name: 'soic-8_b.dra', file_type: 'footprint' },
        { file_name: 'soic-8_b.psm', file_type: 'footprint' },
      ],
      componentCount: 1,
      canDelete: false,
    };

    render(
      <FileTypesView
        fileTypes={[{ id: 'footprint', label: 'Footprint', icon: () => null }]}
        selectedType="footprint"
        selectedEntry={pairEntry}
        showOrphans={false}
        displayedEntries={[pairEntry]}
        componentsData={{ components: [] }}
        getTypeCount={() => 1}
        onTypeChange={vi.fn()}
        onSelectFile={onSelectFile}
        onOpenRename={vi.fn()}
        onOpenDelete={vi.fn()}
        onCopyPath={onCopyPath}
        canWrite={() => true}
        canDeleteFiles={() => true}
        navigate={vi.fn()}
        cisFiles={[]}
        onCISFileChange={vi.fn()}
        onLinkedPartsFilterChange={vi.fn()}
        onToggleBulkSelectMode={vi.fn()}
        onToggleOrphanEntrySelection={vi.fn()}
        onToggleSelectAllDisplayedOrphans={vi.fn()}
        onOpenBulkDelete={vi.fn()}
        selectedOrphanEntryKeys={[]}
      />,
    );

    // Header, list row, and the pair sublist all read uppercase.
    expect(screen.getAllByText('SOIC-8_B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SOIC-8_B.psm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SOIC-8_B.dra').length).toBeGreaterThan(0);
    expect(screen.queryByText('soic-8_b.psm')).not.toBeInTheDocument();

    const selectButton = screen.getByRole('button', { name: /^SOIC-8_B / });
    expect(within(selectButton).queryByRole('button')).not.toBeInTheDocument();
    expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Copy file paths' }));
    expect(onCopyPath).toHaveBeenCalledWith(['soic-8_b.dra', 'soic-8_b.psm']);
    expect(onSelectFile).not.toHaveBeenCalled();
    fireEvent.click(selectButton);
    expect(onSelectFile).toHaveBeenCalledWith(pairEntry.key);

    fireEvent.click(screen.getByRole('button', { name: 'Copy File Path' }));
    expect(onCopyPath).toHaveBeenCalledWith(['soic-8_b.dra', 'soic-8_b.psm'], 'footprint');
  });

  it('keeps orphan deletion separate from selection and exposes bulk toggle state', () => {
    const entry = { key: 'pad-1', displayName: 'test.pad', file_type: 'pad', fileNames: ['test.pad'] };
    const onSelectFile = vi.fn();
    const onOpenDelete = vi.fn();
    const onToggleOrphanEntrySelection = vi.fn();
    const props = {
      fileTypes: [], selectedType: 'pad', showOrphans: true,
      displayedEntries: [entry], selectedOrphanEntryKeys: [], cisFiles: [],
      canDeleteFiles: () => true, onSelectFile, onOpenDelete, onToggleOrphanEntrySelection,
    };
    const { rerender } = render(<FileTypesView {...props} />);
    const selectButton = screen.getByRole('button', { name: /^test.pad/ });
    expect(within(selectButton).queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete orphan file' }));
    expect(onOpenDelete).toHaveBeenCalledWith(entry);
    expect(onSelectFile).not.toHaveBeenCalled();
    fireEvent.click(selectButton);
    expect(onSelectFile).toHaveBeenCalledWith(entry.key);

    rerender(<FileTypesView {...props} bulkSelectMode selectedOrphanEntryKeys={[entry.key]} />);
    const toggle = screen.getByRole('button', { name: /^test.pad/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Delete orphan file' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onToggleOrphanEntrySelection).toHaveBeenCalledWith(entry.key);
    expect(onSelectFile).toHaveBeenCalledTimes(1);
  });
});

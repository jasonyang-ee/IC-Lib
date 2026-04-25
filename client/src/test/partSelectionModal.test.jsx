import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PartSelectionModal from '../components/vendorSearch/PartSelectionModal';

describe('PartSelectionModal', () => {
  it('shows category and status details for each candidate part', () => {
    render(
      <PartSelectionModal
        appendMode="alternative"
        selectedParts={[{ manufacturerPartNumber: 'OPA1622IDRCT' }]}
        libraryPartsForAppend={[
          {
            id: 'component-1',
            part_number: 'IC-00001',
            manufacturer_name: 'Texas Instruments',
            manufacturer_pn: 'OPA1611AID',
            description: 'Audio Amplifier 1 Circuit 8-SOIC',
            category_name: 'Opamp',
            approval_status: 'prototype',
          },
        ]}
        allLibraryParts={[]}
        partSearchTerm="opa1611"
        onPartSearchTermChange={vi.fn()}
        partSortBy="part_number"
        onPartSortByChange={vi.fn()}
        onSelectPart={vi.fn()}
        onClose={vi.fn()}
        onAddAsNewPart={vi.fn()}
        onFilterParts={vi.fn()}
      />,
    );

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Opamp')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('prototype')).toBeInTheDocument();
  });
});
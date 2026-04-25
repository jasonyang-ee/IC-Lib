import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ECOListItem from '../components/eco/ECOListItem';

describe('ECOListItem', () => {
  it('shows category change in dedicated warning block', () => {
    render(
      <ECOListItem
        eco={{
          id: 'eco-1',
          eco_number: 'ECO-1',
          status: 'pending',
          component_part_number: 'IC-00002',
        }}
        expandedECO="eco-1"
        ecoDetails={{
          status: 'pending',
          part_number: 'IC-00002',
          changes: [
            {
              field_name: 'category_id',
              old_value: '1',
              new_value: '2',
              old_category_name: 'IC',
              new_category_name: 'Opamp',
            },
            {
              field_name: 'description',
              old_value: 'Old desc',
              new_value: 'New desc',
            },
          ],
          specifications: [],
          alternatives: [],
          distributors: [],
          cad_files: [],
          stages: [],
          approvals: [],
          rejection_history: [],
        }}
        isLoadingDetails={false}
        canApprove={false}
        currentUserCanAct={false}
        approvalComments=""
        onApprovalCommentsChange={vi.fn()}
        onToggleExpanded={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDownloadPDF={vi.fn()}
        approvePending={false}
        rejectPending={false}
      />,
    );

    expect(screen.getByText('Category Change')).toBeInTheDocument();
    expect(screen.getByText('Old part archived')).toBeInTheDocument();
    expect(screen.getByText('New part created')).toBeInTheDocument();
    expect(screen.getByText('IC-00002 will be archived after approval. A new part number will be created in Opamp.')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(
      screen.queryByText((content, node) => node?.tagName === 'TD' && content === 'Category'),
    ).not.toBeInTheDocument();
  });
});
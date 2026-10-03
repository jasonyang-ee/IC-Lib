import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AlternativePartsEditor from '../components/library/AlternativePartsEditor';

describe('alternative distributor editing', () => {
  it('preserves vendor metadata and custom distributors without modifying the draft during render', () => {
    const existing = { distributor_id: 'dk', distributor_name: 'Digikey', sku: 'old', stock_quantity: 12, price_breaks: [{ quantity: 1, price: 2 }] };
    const custom = { distributor_id: 'custom', distributor_name: 'Custom', sku: 'other' };
    const onUpdateAlternative = vi.fn();
    const props = {
      editData: { alternatives: [{ distributors: [existing, custom] }] }, manufacturers: [], distributors: undefined,
      altManufacturerInputs: {}, setAltManufacturerInputs: vi.fn(), altManufacturerOpen: {}, setAltManufacturerOpen: vi.fn(),
      altManufacturerRefs: { current: [] }, onAddAlternative: vi.fn(), onDeleteAlternative: vi.fn(), onPromoteToPrimary: vi.fn(), onUpdateAlternative,
    };
    const { rerender } = render(<AlternativePartsEditor {...props} />);
    expect(onUpdateAlternative).not.toHaveBeenCalled();
    rerender(<AlternativePartsEditor {...props} distributors={[{ id: 'dk', name: 'Digikey' }, { id: 'custom', name: 'Custom' }]} />);
    expect(onUpdateAlternative).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Digikey SKU' }), { target: { value: 'updated' } });
    expect(onUpdateAlternative).toHaveBeenCalledWith(0, 'distributors', expect.arrayContaining([{ ...existing, sku: 'updated', url: '' }, custom]));
  });
});

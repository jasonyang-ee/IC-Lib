import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Inventory from '../pages/Inventory';

const mocks = vi.hoisted(() => ({
  inventory: [],
  getInventoryAlternatives: vi.fn(),
  updateInventory: vi.fn(),
  updateAlternativeInventory: vi.fn(),
  invalidateQueries: vi.fn(),
  showError: vi.fn(),
}));
vi.mock('../utils/api', () => ({ api: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canWrite: () => true }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showError: mocks.showError }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQuery: ({ queryKey }) => ({
    data: queryKey[0] === 'inventory' ? mocks.inventory : [],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

const renderInventory = () => render(<MemoryRouter><Inventory /></MemoryRouter>);
const rowFor = name => screen.getByRole('row', { name: new RegExp(name) });

describe('inventory edit preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inventory = [{ id: 'i1', component_id: 'c1', part_number: 'PART-1', manufacturer_pn: 'MPN-1', quantity: 10, minimum_quantity: 2, location: 'A' }];
    mocks.getInventoryAlternatives.mockResolvedValue({ data: [] });
    mocks.updateInventory.mockResolvedValue({ data: {} });
    mocks.updateAlternativeInventory.mockResolvedValue({ data: {} });
  });

  it('saves edited rows even after search hides them', async () => {
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: 'Edit All' }));
    fireEvent.change(within(rowFor('PART-1')).getByPlaceholderText('Enter location...'), { target: { value: 'B' } });
    fireEvent.change(screen.getByPlaceholderText('Full data search ...'), { target: { value: 'no-match' } });
    await waitFor(() => expect(screen.queryByText('PART-1')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));
    await waitFor(() => expect(mocks.updateInventory).toHaveBeenCalledWith('i1', { location: 'B' }));
  });

  it('uses the loaded alternative quantity when its first edit receives stock', async () => {
    let resolveAlternatives;
    mocks.getInventoryAlternatives.mockReturnValue(new Promise(resolve => { resolveAlternatives = resolve; }));
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: 'Edit All' }));
    await act(async () => resolveAlternatives({ data: [{ id: 'alt1', manufacturer_pn: 'ALT-PN', quantity: 7, minimum_quantity: 3, location: 'ALT-A' }] }));
    const alternativeRow = rowFor('ALT-PN');
    fireEvent.change(within(alternativeRow).getAllByRole('spinbutton')[2], { target: { value: '2' } });
    mocks.getInventoryAlternatives.mockResolvedValue({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));
    await waitFor(() => expect(mocks.updateAlternativeInventory).toHaveBeenCalledWith('alt1', { quantity: 9 }));
  });

  it('prevents duplicate saves and changes to the submitted edit while requests are pending', async () => {
    let resolveUpdate;
    mocks.updateInventory.mockReturnValue(new Promise(resolve => { resolveUpdate = resolve; }));
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: 'Edit All' }));
    const locationInput = within(rowFor('PART-1')).getByPlaceholderText('Enter location...');
    fireEvent.change(locationInput, { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));
    expect(screen.getByRole('button', { name: /Sav(e All|ing)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(locationInput).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Sav(e All|ing)/ }));
    expect(mocks.updateInventory).toHaveBeenCalledTimes(1);
    await act(async () => resolveUpdate({ data: {} }));
    expect(screen.getByRole('button', { name: 'Edit All' })).toBeEnabled();
  });
});

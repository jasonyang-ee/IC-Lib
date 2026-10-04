import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Library from '../pages/Library';
import Projects from '../pages/Projects';

const mocks = vi.hoisted(() => ({ api: {}, showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock('../utils/api', () => ({ api: mocks.api }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canWrite: () => true, canApprove: () => false, user: { role: 'admin' } }) }));
vi.mock('../contexts/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ ecoEnabled: true }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ ...mocks, showInfo: vi.fn() }) }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: ({ count }) => ({
  getTotalSize: () => count * 45,
  getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 45 })),
  measureElement: () => {},
}) }));
// Keep the real Library query and assignment view; unrelated part editors are omitted.
vi.mock('../components/library', async () => ({
  AssignedProjectsView: (await import('../components/library/AssignedProjectsView')).default,
  ComponentDetailView: () => null,
  ComponentEditForm: () => null,
  DistributorInfoSection: () => null,
}));

const component = { id: 'c1', part_number: 'P-1', manufacturer_pn: 'PART-1', approval_status: 'new' };
const project = { id: 'p1', name: 'Board', status: 'active' };
const assignment = { ...project, total_quantity: 2, assigned_item_count: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ['getCategories', 'getManufacturers', 'getDistributors', 'getComponentSpecifications', 'getComponentDistributors', 'getComponentAlternatives']) {
    mocks.api[method] = vi.fn().mockResolvedValue({ data: [] });
  }
  mocks.api.getComponents = vi.fn().mockResolvedValue({ data: [component] });
  mocks.api.getComponentById = vi.fn().mockResolvedValue({ data: component });
  mocks.api.getCadFilesForComponent = vi.fn().mockResolvedValue({ data: { files: {} } });
  mocks.api.getComponentProjects = vi.fn();
  mocks.api.getProjects = vi.fn().mockResolvedValue({ data: [project] });
  mocks.api.getProjectById = vi.fn().mockResolvedValue({ data: {
    ...project, components: [{ ...component, id: 'pc1', component_id: component.id, quantity: 2 }],
  } });
  mocks.api.getSettings = vi.fn().mockResolvedValue({ data: {} });
  for (const method of ['addComponentToProject', 'removeComponentFromProject', 'updateProjectComponent', 'deleteProject']) {
    mocks.api[method] = vi.fn().mockResolvedValue({ data: {} });
  }
  mocks.api.updateProject = vi.fn().mockResolvedValue({ data: { ...project, name: 'Revised board', status: 'completed' } });
});

const editCases = [
  {
    change: 'adding a component', initial: [], updated: [{ ...assignment, total_quantity: 1 }],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Component', exact: true }));
      fireEvent.change(screen.getByPlaceholderText('Search components by part number, MFG P/N, or description...'), { target: { value: 'PART-1' } });
      fireEvent.click(await screen.findByText('P-1', { selector: 'span' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add to Project' }));
      await waitFor(() => expect(mocks.api.addComponentToProject).toHaveBeenCalledWith('p1', { component_id: 'c1', quantity: 1, alt_class: null }));
    },
  },
  {
    change: 'removing a component', updated: [],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Component' }));
      await waitFor(() => expect(mocks.api.removeComponentFromProject).toHaveBeenCalledWith('p1', 'pc1'));
    },
  },
  {
    change: 'changing quantity', updated: [{ ...assignment, total_quantity: 7 }],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Quantity' }));
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Quantity' }));
      await waitFor(() => expect(mocks.api.updateProjectComponent).toHaveBeenCalledWith('p1', 'pc1', { quantity: 7, alt_class: null }));
    },
  },
  {
    change: 'renaming a project and changing status', updated: [{ ...assignment, name: 'Revised board', status: 'completed' }],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
      fireEvent.change(screen.getByDisplayValue('Board'), { target: { value: 'Revised board' } });
      fireEvent.change(screen.getByDisplayValue('Active'), { target: { value: 'completed' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
      await waitFor(() => expect(mocks.api.updateProject).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Revised board', status: 'completed' })));
    },
  },
  {
    change: 'deleting a project', updated: [],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete', exact: true }).at(-1));
      await waitFor(() => expect(mocks.api.deleteProject).toHaveBeenCalledWith('p1'));
    },
  },
  {
    change: 'bulk importing components', initial: [], updated: [{ ...assignment, total_quantity: 1 }],
    save: async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Component', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Bulk Import' }));
      fireEvent.change(screen.getByPlaceholderText(/Example:/), { target: { value: 'PART-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search All' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Add 1 Components' }));
      await waitFor(() => expect(mocks.showSuccess).toHaveBeenCalledWith('Successfully added 1 component(s) to project'));
    },
  },
];

it.each(editCases)('refreshes Library assignments after $change without waiting for cache expiry', async ({ initial = [assignment], updated, save }) => {
  mocks.api.getComponentProjects.mockResolvedValueOnce({ data: initial }).mockResolvedValue({ data: updated });
  if (!initial.length) mocks.api.getProjectById.mockResolvedValue({ data: { ...project, components: [] } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
  render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/library']}>
      <Link to="/library">Open Library</Link>
      <Link to="/projects">Open Projects</Link>
      <Routes>
        <Route path="/library" element={<Library />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);

  fireEvent.click(await screen.findByText('P-1'));
  if (initial.length) await screen.findByText('Qty: 2');
  else await screen.findByText('Not assigned to any projects');
  expect(mocks.api.getComponentProjects).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('link', { name: 'Open Projects' }));
  fireEvent.click(await screen.findByText('Board'));
  await screen.findByRole('heading', { name: 'Board', level: 2 });
  await save();
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));

  fireEvent.click(screen.getByRole('link', { name: 'Open Library' }));
  fireEvent.click(await screen.findByText('P-1'));
  await waitFor(() => expect(mocks.api.getComponentProjects).toHaveBeenCalledTimes(2));
  const assignmentView = updated.length
    ? await screen.findByRole('button', { name: `${updated[0].name} ${updated[0].status} Qty: ${updated[0].total_quantity} Entries: 1` })
    : await screen.findByText('Not assigned to any projects');
  expect(assignmentView).toBeInTheDocument();
});

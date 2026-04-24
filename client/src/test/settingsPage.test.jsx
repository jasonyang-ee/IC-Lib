import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Settings from '../pages/Settings';

vi.mock('../components/settings', () => {
  const createTab = (label) => () => <div>{label}</div>;

  return {
    BomTab: createTab('BOM Tab'),
    CategoryTab: createTab('Category Tab'),
    EcoTab: createTab('ECO Tab'),
    EmailTab: createTab('Email Tab'),
    LogsTab: createTab('Logs Tab'),
    OperationTab: createTab('Operation Tab'),
    UpdateTab: createTab('Update Tab'),
    UserTab: createTab('User Tab'),
  };
});

describe('Settings page', () => {
  it('renders requested tab labels and switches active tab content', () => {
    render(<Settings />);

    expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BOM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ECO' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Operation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
    expect(screen.getByText('User Tab')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Operation' }));

    expect(screen.getByText('Operation Tab')).toBeInTheDocument();
  });
});
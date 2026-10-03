import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext';

const Trigger = () => {
  const { showSuccess, showError } = useNotification();
  return <><button onClick={() => showSuccess('Saved', 5000)}>Save</button><button onClick={() => showError('Retry required', 0)}>Fail</button></>;
};

afterEach(() => vi.useRealTimers());

it('keeps a newer persistent error visible after the prior success timer expires', () => {
  vi.useFakeTimers();
  render(<NotificationProvider><Trigger /></NotificationProvider>);
  fireEvent.click(screen.getByText('Save'));
  act(() => vi.advanceTimersByTime(4000));
  fireEvent.click(screen.getByText('Fail'));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByRole('alert')).toHaveTextContent('Retry required');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

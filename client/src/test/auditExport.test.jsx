import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Audit from '../pages/Audit';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [{
  id: 'log1', created_at: '2026-09-07T12:00:00Z', user_name: 'A "quoted", user',
  part_number: 'P"1', activity_type: 'component_created', details: { note: 'say "hello"' },
}], isLoading: false }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showInfo: vi.fn() }) }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('audit export', () => {
  it('escapes every CSV field and releases the download URL', async () => {
    let downloaded;
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL(blob) { downloaded = blob; return 'blob:audit-export'; }
      static revokeObjectURL = revoke;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Audit />);
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    const csv = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(downloaded);
    });
    expect(csv).toContain('"A ""quoted"", user","P""1"');
    expect(csv).toContain('"{""note"":""say \\""hello\\""""}"');
    expect(revoke).toHaveBeenCalledWith('blob:audit-export');
  });
});

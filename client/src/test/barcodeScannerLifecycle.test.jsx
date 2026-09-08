import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BarcodeScanner from '../components/common/BarcodeScanner';

vi.mock('barcode-detector/ponyfill', () => ({ BarcodeDetector: class { detect = vi.fn().mockResolvedValue([]); } }));

let getUserMedia;
let stop;
beforeEach(() => {
  stop = vi.fn();
  const track = { stop, getCapabilities: () => ({ torch: true }), applyConstraints: vi.fn().mockResolvedValue() };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: {
    getUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput', deviceId: 'rear', label: 'Rear camera' }]),
  } });
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('barcode camera lifecycle', () => {
  it('keeps the selected camera running when torch state changes', async () => {
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn torch on' }));
    await screen.findByRole('button', { name: 'Turn torch off' });
    expect(getUserMedia).toHaveBeenCalledTimes(2); // permission probe and selected camera
  });

  it('stops a camera stream that arrives after the scanner unmounts', async () => {
    let resolveStream;
    getUserMedia.mockImplementationOnce(() => new Promise(resolve => { resolveStream = resolve; }));
    const view = render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />);
    view.unmount();
    await act(async () => resolveStream({ getTracks: () => [{ stop }] }));
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

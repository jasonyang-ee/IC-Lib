import { useState, useEffect, useRef, useCallback } from 'react';
import { BarcodeDetector } from 'barcode-detector/ponyfill';
import { X, Flashlight, FlashlightOff } from 'lucide-react';

/**
 * Shared camera barcode scanner modal component.
 *
 * Uses the barcode-detector ponyfill (ZXing WASM under the hood) to detect
 * DataMatrix (Digikey) and Code128 (Mouser) barcodes from a live camera feed.
 *
 * Props:
 *   onScan(rawValue)  - called when a barcode is detected
 *   onClose()         - called to dismiss the modal
 *   formats           - array of barcode formats (default: ['data_matrix', 'code_128'])
 */
// Detection cadence and detector input size. Detecting every rAF frame (~60 fps)
// on the full-res frame saturates the main thread and feeds blurry frames to the
// WASM detector; ~8 fps on a downscaled frame is both faster and more accurate.
const DETECT_INTERVAL_MS = 125;
const DETECT_MAX_WIDTH = 640;

const BarcodeScanner = ({ onScan, onClose, formats = ['data_matrix', 'code_128'] }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const scanningRef = useRef(true);
  const lastDetectRef = useRef(0);
  const detectCanvasRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [error, setError] = useState(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Enumerate cameras on mount
  useEffect(() => {
    const enumerate = async () => {
      try {
        // Request permission first so labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);

        if (videoDevices.length === 0) {
          setError('No cameras found on your device.');
          return;
        }

        // Prefer rear camera
        const rear = videoDevices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear')
        );
        setSelectedCamera(rear ? rear.deviceId : videoDevices[0].deviceId);
      } catch (err) {
        console.error('Camera enumeration error:', err);
        setError('Failed to access camera. Please check permissions.');
      }
    };
    enumerate();
  }, []);

  // Stop everything
  const cleanup = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera + scanning loop when camera is selected
  useEffect(() => {
    if (!selectedCamera) return;

    let cancelled = false;

    const start = async () => {
      // Cleanup any previous stream
      cleanup();
      scanningRef.current = true;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        // Continuous autofocus + torch capability (sharper frames beat more frames)
        const [track] = stream.getVideoTracks();
        const capabilities = track?.getCapabilities?.() || {};
        if (capabilities.focusMode?.includes('continuous')) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          } catch {
            // Focus mode is best-effort
          }
        }
        setTorchSupported(Boolean(capabilities.torch));
        setTorchOn(false);

        // Create detector once
        if (!detectorRef.current) {
          detectorRef.current = new BarcodeDetector({ formats });
        }

        // Scanning loop: rAF keeps the preview smooth, detection is throttled
        // and runs on a downscaled offscreen canvas
        lastDetectRef.current = 0;
        const scan = async () => {
          if (!scanningRef.current || cancelled) return;

          const now = performance.now();
          if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
            lastDetectRef.current = now;
            try {
              if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                if (!detectCanvasRef.current) {
                  detectCanvasRef.current = document.createElement('canvas');
                }
                const canvas = detectCanvasRef.current;
                const scale = Math.min(1, DETECT_MAX_WIDTH / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const barcodes = await detectorRef.current.detect(canvas);
                if (barcodes.length > 0 && scanningRef.current) {
                  scanningRef.current = false;
                  cleanup();
                  onScan(barcodes[0].rawValue);
                  return;
                }
              }
            } catch {
              // Ignore detection errors (e.g. video not ready)
            }
          }

          rafRef.current = requestAnimationFrame(scan);
        };

        rafRef.current = requestAnimationFrame(scan);
      } catch (err) {
        if (!cancelled) {
          console.error('Camera start error:', err);
          setError('Failed to start camera scanner.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [selectedCamera, formats, onScan, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const handleCameraChange = (e) => {
    setSelectedCamera(e.target.value);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {
      // Torch is best-effort; ignore devices that reject the constraint
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Scan Barcode with Camera
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        ) : (
          <>
            {/* Camera Selection */}
            {cameras.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Camera
                </label>
                <select
                  value={selectedCamera}
                  onChange={handleCameraChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  {cameras.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Video Feed */}
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600"
                playsInline
                muted
              />
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-md transition-colors"
                  title={torchOn ? 'Turn torch off' : 'Turn torch on'}
                >
                  {torchOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
                </button>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
              Hold barcode in front of camera — scanning continuously
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;

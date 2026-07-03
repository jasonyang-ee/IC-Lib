import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { decodeVendorBarcode } from '../../utils/vendorBarcode';

/**
 * Self-contained vendor barcode scan panel (keyboard-wedge input + camera).
 *
 * The per-keystroke input state lives here, so a scan gun's keystroke burst
 * re-renders only this panel — never the host page. Scan guns terminate with
 * Enter/Tab, which decodes immediately; a short debounce is the fallback for
 * scanners without a terminator suffix. The parent receives only decoded
 * results via onDecode — raw ECIA payloads never leave the panel.
 *
 * Props:
 *   onDecode(result)          - called with every decode result (incl. errors)
 *   renderResultExtra(result) - optional page-specific content under a successful decode
 *   variant                   - 'sidebar' (stacked, compact) | 'inline' (single row)
 *   autoFocus                 - focus the scan input on mount
 */
const VendorBarcodeScanPanel = ({ onDecode, renderResultExtra, variant = 'sidebar', autoFocus = false }) => {
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    return () => clearTimeout(debounceRef.current);
  }, [autoFocus]);

  const refocus = () => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const runDecode = (raw) => {
    clearTimeout(debounceRef.current);
    if (!raw?.trim()) return;

    const decoded = decodeVendorBarcode(raw);
    setResult(decoded);
    onDecodeRef.current?.(decoded);
    refocus();
  };

  const handleChange = (event) => {
    const next = event.target.value;
    setValue(next);
    clearTimeout(debounceRef.current);
    // Fallback for scanners without an Enter/Tab suffix
    if (next.length > 10) {
      debounceRef.current = setTimeout(() => runDecode(next), 250);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      runDecode(event.currentTarget.value);
    }
  };

  const handleClear = () => {
    clearTimeout(debounceRef.current);
    setValue('');
    setResult(null);
    refocus();
  };

  const handleCameraScan = (raw) => {
    setShowCamera(false);
    setValue('');
    runDecode(raw);
  };

  const isSidebar = variant === 'sidebar';
  const buttonPad = isSidebar ? 'py-1.5 px-3' : 'py-2 px-4';

  const input = (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Scan Digikey or Mouser barcode..."
      className={`${isSidebar ? 'w-full' : 'flex-1'} px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm`}
    />
  );

  const buttons = (
    <>
      <button
        onClick={() => runDecode(value)}
        disabled={!value.trim()}
        className={`${isSidebar ? 'flex-1' : ''} bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white ${buttonPad} rounded-md text-sm font-medium transition-colors`}
      >
        Decode
      </button>
      <button
        onClick={handleClear}
        className={`bg-gray-500 hover:bg-gray-600 text-white ${buttonPad} rounded-md text-sm font-medium transition-colors`}
      >
        Clear
      </button>
      <button
        onClick={() => setShowCamera(true)}
        className={`bg-blue-600 hover:bg-blue-700 text-white ${buttonPad} rounded-md text-sm font-medium transition-colors flex items-center gap-1`}
        title="Scan with camera"
      >
        <Camera className="w-4 h-4" />
      </button>
    </>
  );

  return (
    <div>
      <div className="space-y-2">
        {isSidebar ? (
          <>
            {input}
            <div className="flex gap-2">{buttons}</div>
          </>
        ) : (
          <div className="flex gap-2">
            {input}
            {buttons}
          </div>
        )}

        {result && (
          <div className={`mt-2 p-3 rounded-md text-sm ${
            result.error
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-200'
          }`}>
            {result.error ? (
              <p>{result.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold">{result.vendor || 'Vendor'} Barcode Decoded:</p>
                {result.manufacturerPN && (
                  <p>MFG P/N: <span className="font-mono">{result.manufacturerPN}</span></p>
                )}
                {!result.multiField && result.searchTerm && (
                  <p>Scanned: <span className="font-mono">{result.searchTerm}</span></p>
                )}
                {result.digikeySKU && (
                  <p>Digikey SKU: <span className="font-mono">{result.digikeySKU}</span></p>
                )}
                {result.mouserSKU && (
                  <p>Mouser SKU: <span className="font-mono">{result.mouserSKU}</span></p>
                )}
                {result.manufacturerName && (
                  <p>Manufacturer: {result.manufacturerName}</p>
                )}
                {result.quantity != null && (
                  <p>Quantity: {result.quantity}</p>
                )}
                {renderResultExtra?.(result)}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Supports Digikey 2D Data Matrix and Mouser Code 128 barcodes
      </p>

      {showCamera && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default VendorBarcodeScanPanel;

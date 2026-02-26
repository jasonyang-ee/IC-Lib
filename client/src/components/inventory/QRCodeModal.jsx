import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const QRCodeModal = ({
  qrCodeModal,
  onClose,
  onCopyQRImage,
  onCopyQRField,
  copiedQRField,
}) => {
  if (!qrCodeModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-8 max-w-6xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">QR Codes</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-8">
          {/* QR Codes Display - Three Columns */}
          <div className="grid grid-cols-3 gap-8">
            {/* Full Data QR Code */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Full Information</h4>
              <div
                id="qr-full"
                onClick={() => onCopyQRImage(qrCodeModal.qrData, 'full')}
                className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                title="Click to copy QR code image"
              >
                <div className="bg-white p-4 inline-block">
                  <QRCodeSVG
                    value={qrCodeModal.qrData}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <span className={`mt-2 text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'img-full' ? 'visible' : 'invisible'}`}>
                QR Code Copied!
              </span>
              <button
                onClick={() => onCopyQRField(qrCodeModal.qrData, 'full-text')}
                className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                title="Click to copy text"
              >
                {qrCodeModal.qrData}
              </button>
              <span className={`text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'full-text' ? 'visible' : 'invisible'}`}>
                Text Copied!
              </span>
            </div>

            {/* Manufacturer Part Number Only QR Code */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">MFG Part Number</h4>
              <div
                id="qr-mfg"
                onClick={() => onCopyQRImage(qrCodeModal.qrMfgOnly, 'mfg')}
                className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                title="Click to copy QR code image"
              >
                <div className="bg-white p-4 inline-block">
                  <QRCodeSVG
                    value={qrCodeModal.qrMfgOnly}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <span className={`mt-2 text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'img-mfg' ? 'visible' : 'invisible'}`}>
                QR Code Copied!
              </span>
              <button
                onClick={() => onCopyQRField(qrCodeModal.qrMfgOnly, 'mfg-text')}
                className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                title="Click to copy text"
              >
                {qrCodeModal.qrMfgOnly}
              </button>
              <span className={`text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'mfg-text' ? 'visible' : 'invisible'}`}>
                Text Copied!
              </span>
            </div>

            {/* UUID QR Code */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Component UUID</h4>
              <div
                id="qr-uuid"
                onClick={() => onCopyQRImage(qrCodeModal.qrUuid || 'N/A', 'uuid')}
                className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:border-primary-500 transition-colors"
                title="Click to copy QR code image"
              >
                <div className="bg-white p-4 inline-block">
                  <QRCodeSVG
                    value={qrCodeModal.qrUuid || 'N/A'}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <span className={`mt-2 text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'img-uuid' ? 'visible' : 'invisible'}`}>
                QR Code Copied!
              </span>
              <button
                onClick={() => onCopyQRField(qrCodeModal.qrUuid || 'N/A', 'uuid-text')}
                className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-2 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                title="Click to copy text"
              >
                {qrCodeModal.qrUuid || 'N/A'}
              </button>
              <span className={`text-xs text-green-600 dark:text-green-400 font-semibold h-4 ${copiedQRField === 'uuid-text' ? 'visible' : 'invisible'}`}>
                Text Copied!
              </span>
            </div>
          </div>

          {/* Item Info */}
          <div className="space-y-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Part Number:</span>
                <button
                  onClick={() => onCopyQRField(qrCodeModal.item.part_number, 'info-pn')}
                  className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                  title="Click to copy"
                >
                  {qrCodeModal.item.part_number}
                </button>
                {copiedQRField === 'info-pn' && (
                  <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">MFG Part Number:</span>
                <button
                  onClick={() => onCopyQRField(qrCodeModal.item.manufacturer_pn || 'N/A', 'info-mfg')}
                  className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                  title="Click to copy"
                >
                  {qrCodeModal.item.manufacturer_pn || 'N/A'}
                </button>
                {copiedQRField === 'info-mfg' && (
                  <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Description:</span>
              <button
                onClick={() => onCopyQRField(qrCodeModal.item.description || 'N/A', 'info-desc')}
                className="text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                title="Click to copy"
              >
                {qrCodeModal.item.description || 'N/A'}
              </button>
              {copiedQRField === 'info-desc' && (
                <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Component UUID:</span>
              <button
                onClick={() => onCopyQRField(qrCodeModal.item.component_id || 'N/A', 'info-uuid')}
                className="text-gray-900 dark:text-gray-100 font-mono text-xs hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer underline decoration-dotted"
                title="Click to copy"
              >
                {qrCodeModal.item.component_id || 'N/A'}
              </button>
              {copiedQRField === 'info-uuid' && (
                <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;

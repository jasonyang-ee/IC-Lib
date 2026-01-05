/**
 * Toast notification component for temporary messages
 */
const Toast = ({ show, message, type = 'success', onClose, duration = 3000 }) => {
  if (!show) return null;

  const typeStyles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600',
  };

  // Auto-close after duration
  if (duration > 0 && onClose) {
    setTimeout(() => onClose(), duration);
  }

  return (
    <div className={`fixed bottom-4 right-4 ${typeStyles[type]} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in`}>
      {message}
    </div>
  );
};

export default Toast;

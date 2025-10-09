/**
 * Database Management Component for Settings Page
 * Example implementation showing how to use the database management API
 */

import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const DatabaseManagement = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Fetch database status on component mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.getDatabaseStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch database status:', error);
      setMessage({ type: 'error', text: 'Failed to fetch database status' });
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('This will clear all data from the database while preserving the schema. Continue?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await api.clearDatabase();
      const result = response.data;

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `${result.message}\nCleared ${result.clearedTables.length} tables.` 
        });
        await fetchStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      setMessage({ type: 'error', text: `Error: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFullReset = async () => {
    const confirmText = window.prompt(
      'WARNING: This will DROP ALL TABLES and recreate the schema!\n\n' +
      'Type "DELETE ALL DATA" to confirm:'
    );

    if (confirmText !== 'DELETE ALL DATA') {
      setMessage({ type: 'info', text: 'Reset cancelled.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await api.resetDatabase(true); // Pass confirm=true
      const result = response.data;

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `${result.message}\nCompleted ${result.steps.length} steps.` 
        });
        await fetchStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      setMessage({ type: 'error', text: `Error: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (!window.confirm('Load sample data into the database?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await api.loadSampleData();
      const result = response.data;

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `${result.message}\nLoaded records into ${Object.keys(result.recordCounts).length} tables.` 
        });
        await fetchStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      setMessage({ type: 'error', text: `Error: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="database-management">
      <h2>Database Management</h2>

      {/* Status Display */}
      {status && (
        <div className="status-panel">
          <h3>Database Status</h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Connection:</span>
              <span className={`value ${status.connected ? 'connected' : 'disconnected'}`}>
                {status.connected ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Tables:</span>
              <span className="value">{status.tableCount}</span>
            </div>
            {status.recordCounts && Object.keys(status.recordCounts).length > 0 && (
              <>
                <div className="status-item">
                  <span className="label">Components:</span>
                  <span className="value">{status.recordCounts.components || 0}</span>
                </div>
                <div className="status-item">
                  <span className="label">Manufacturers:</span>
                  <span className="value">{status.recordCounts.manufacturers || 0}</span>
                </div>
                <div className="status-item">
                  <span className="label">Inventory:</span>
                  <span className="value">{status.recordCounts.inventory || 0}</span>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={fetchStatus} 
            disabled={loading}
            className="btn-secondary"
          >
            Refresh Status
          </button>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Action Buttons */}
      <div className="actions-panel">
        <h3>Database Actions</h3>
        
        <div className="action-group">
          <button
            onClick={handleClearDatabase}
            disabled={loading}
            className="btn btn-warning"
          >
            {loading ? 'Processing...' : 'Clear Data (Safe)'}
          </button>
          <p className="action-description">
            Removes all data from tables while preserving schema and structure.
            Recommended for regular use.
          </p>
        </div>

        <div className="action-group">
          <button
            onClick={handleLoadSampleData}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Processing...' : 'Load Sample Data'}
          </button>
          <p className="action-description">
            Loads test/sample data into the database. Use after clearing data.
          </p>
        </div>

        <div className="action-group">
          <button
            onClick={handleFullReset}
            disabled={loading}
            className="btn btn-danger"
          >
            {loading ? 'Processing...' : 'Full Reset (Destructive)'}
          </button>
          <p className="action-description">
            ⚠️ WARNING: Drops all tables and recreates schema. Use only when schema needs updating.
          </p>
        </div>
      </div>

      <style jsx>{`
        .database-management {
          padding: 20px;
          max-width: 800px;
        }

        .status-panel {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 15px 0;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: white;
          border-radius: 4px;
        }

        .label {
          font-weight: 600;
          color: #666;
        }

        .value {
          font-weight: 500;
        }

        .connected {
          color: #22c55e;
        }

        .disconnected {
          color: #ef4444;
        }

        .message {
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
          white-space: pre-line;
        }

        .message-success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }

        .message-error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }

        .message-info {
          background: #dbeafe;
          color: #1e40af;
          border: 1px solid #3b82f6;
        }

        .actions-panel {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
        }

        .action-group {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .action-group:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .action-description {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-warning {
          background: #f59e0b;
          color: white;
        }

        .btn-warning:hover:not(:disabled) {
          background: #d97706;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
          padding: 8px 16px;
          margin-top: 10px;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
};

export default DatabaseManagement;

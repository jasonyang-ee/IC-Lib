import { expect, it, vi } from 'vitest';
const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../config/database.js', () => ({ default: { connect, query: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
import { createECO, approveECO, rejectECO, getECOById, deleteECO, importApprovalStages } from '../controllers/ecoController.js';
import { updateCategoryConfig, importUsers, importCategories } from '../controllers/settingsController.js';
import { saveSMTPSettings } from '../controllers/smtpController.js';
import { promoteAlternative, changeComponentCategory } from '../controllers/componentController.js';

it.each([createECO, approveECO, rejectECO, getECOById, deleteECO, importApprovalStages,
  updateCategoryConfig, importUsers, importCategories, saveSMTPSettings, promoteAlternative, changeComponentCategory])('returns an API error when %s cannot acquire a connection', async handler => {
  const error = new Error('database unavailable');
  connect.mockRejectedValue(error);
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await expect(handler({ params: {}, body: {}, user: {} }, res, next)).resolves.toBeUndefined();
  expect(res.status.mock.calls.some(([status]) => status === 500) || next.mock.calls.some(([received]) => received === error)).toBe(true);
});

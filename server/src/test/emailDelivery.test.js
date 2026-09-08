import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, sendMail } = vi.hoisted(() => ({ query: vi.fn(), sendMail: vi.fn() }));
vi.mock('../config/database.js', () => ({ default: { query } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock('../utils/logger.js', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));
import { sendEmail, sendECONotification } from '../services/emailService.js';

describe('email delivery outcomes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sendMail.mockResolvedValue({ messageId: 'delivered' });
    query.mockImplementation(async sql => {
      if (sql.includes('SELECT * FROM smtp_settings')) {
        return { rows: [{ enabled: true, no_auth: true, from_name: 'Library', from_address: 'library@example.com' }] };
      }
      throw new Error('log unavailable');
    });
  });

  it('retains successful delivery when the audit log fails', async () => {
    await expect(sendEmail({ to: 'operator@example.com', subject: 'Review', text: 'Ready' }))
      .resolves.toEqual({ success: true, messageId: 'delivered' });
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('retains the transport failure when logging also fails', async () => {
    sendMail.mockRejectedValue(new Error('relay refused'));
    await expect(sendEmail({ to: 'operator@example.com', subject: 'Review', text: 'Ready' }))
      .resolves.toEqual({ success: false, error: 'relay refused' });
  });

  it('records the ECO on each delivery without a later ambiguous log update', async () => {
    query.mockImplementation(async sql => {
      if (sql.includes('SELECT * FROM smtp_settings')) {
        return { rows: [{ enabled: true, no_auth: true, from_name: 'Library', from_address: 'library@example.com' }] };
      }
      if (sql.includes('SELECT u.id')) return { rows: [{ email: 'operator@example.com' }] };
      if (sql.includes('INSERT INTO email_log')) return { rows: [] };
      throw new Error('Unexpected post-delivery query');
    });
    await expect(sendECONotification({ id: 'eco-1', eco_number: 'ECO-1', part_number: 'PART-1' }, 'eco_created'))
      .resolves.toEqual([{ success: true, messageId: 'delivered', recipient: 'operator@example.com' }]);
    const log = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO email_log'));
    expect(log[0]).toContain('eco_id');
    expect(log[1]).toEqual(['operator@example.com', '[ECO-1] New Engineering Change Order Created', 'generic', 'sent', null, 'eco-1']);
  });
});

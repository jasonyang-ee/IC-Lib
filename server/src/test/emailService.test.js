import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('emailService templates', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('prefers CONFIG_BASE_URL and trims trailing slash', async () => {
    vi.stubEnv('CONFIG_BASE_URL', 'https://flat.gentex.int/emd-dev/');
    vi.stubEnv('APP_URL', 'https://legacy.example/app');
    vi.stubEnv('BASE_DOMAIN', 'https://legacy-domain.example');

    const { getConfiguredBaseUrl } = await import('../services/emailService.js');

    expect(getConfiguredBaseUrl()).toBe('https://flat.gentex.int/emd-dev');
  });

  it('builds welcome email with CONFIG_BASE_URL login link', async () => {
    vi.stubEnv('CONFIG_BASE_URL', 'https://flat.gentex.int/emd-dev');

    const { buildWelcomeEmail } = await import('../services/emailService.js');

    const email = buildWelcomeEmail({
      username: 'jyang',
      role: 'approver',
      displayName: 'Jason Yang',
      password: 'Temp1234',
      passwordWasGenerated: true,
    });

    expect(email.subject).toContain('Welcome to IC-Lib');
    expect(email.html).toContain('Welcome to IC-Lib');
    expect(email.html).toContain('Temporary Password');
    expect(email.html).toContain('https://flat.gentex.int/emd-dev');
    expect(email.text).toContain('System URL: https://flat.gentex.int/emd-dev');
  });

  it('builds assigned ECO preview email with approval copy', async () => {
    vi.stubEnv('CONFIG_BASE_URL', 'https://flat.gentex.int/emd-dev');

    const { buildPreviewEmail } = await import('../services/emailService.js');

    const email = buildPreviewEmail('eco_assigned');

    expect(email.subject).toBe('[Preview] ECO Assigned');
    expect(email.html).toContain('ECO Assigned For Approval');
    expect(email.html).toContain('Engineering Review');
    expect(email.text).toContain('View ECO: https://flat.gentex.int/emd-dev/eco');
  });
});
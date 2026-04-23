import nodemailer from 'nodemailer';
import crypto from 'crypto';
import pool from '../config/database.js';

// Encryption key for SMTP password (should be set in environment variables)
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;
const DEFAULT_CONFIG_BASE_URL = 'http://localhost:3000';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeBaseUrl = (value) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return DEFAULT_CONFIG_BASE_URL;
  }

  return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue;
};

const formatRoleLabel = (role) => String(role || '').replace(/-/g, ' ');

const renderDetailRows = (rows) => rows
  .filter(({ value }) => value !== undefined && value !== null && value !== '')
  .map(({ label, value, emphasize = false }) => `
    <tr>
      <td style="padding: 14px 0; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #e5e7eb;">${escapeHtml(label)}</td>
      <td style="padding: 14px 0; font-size: 16px; color: #111827; font-weight: ${emphasize ? '700' : '600'}; text-align: right; border-bottom: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
    </tr>
  `)
  .join('');

const renderParagraphs = (paragraphs) => paragraphs
  .filter(Boolean)
  .map((paragraph) => `
    <p style="margin: 0 0 14px 0; font-size: 16px; line-height: 1.7; color: #4b5563;">${escapeHtml(paragraph)}</p>
  `)
  .join('');

const renderEmailLayout = ({
  preheader,
  eyebrow,
  title,
  paragraphs = [],
  sectionTitle,
  rows = [],
  note,
  accentColor = '#2563eb',
  ctaLabel,
  ctaUrl,
  footerText = 'Automated message from IC-Lib. Please do not reply to this email.',
}) => {
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : '';
  const detailRowsHtml = rows.length > 0 ? renderDetailRows(rows) : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background: linear-gradient(180deg, #eef4ff 0%, #f7f9fc 100%); font-family: 'Segoe UI', Arial, sans-serif; color: #111827;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(preheader || title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background: linear-gradient(180deg, #eef4ff 0%, #f7f9fc 100%);">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 760px; width: 100%; border-collapse: separate; border-spacing: 0;">
          <tr>
            <td style="padding: 0 0 18px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${escapeHtml(accentColor)};">${escapeHtml(eyebrow)}</p>
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; border-radius: 28px; padding: 56px 56px 40px; box-shadow: 0 28px 64px rgba(15, 23, 42, 0.12); border: 1px solid #dbe4f0;">
              <div style="height: 4px; width: 96px; margin: 0 auto 28px; border-radius: 999px; background: ${escapeHtml(accentColor)};"></div>
              <h1 style="margin: 0 0 26px 0; font-size: 42px; line-height: 1.1; font-weight: 800; text-align: center; color: #111827;">${escapeHtml(title)}</h1>
              <div style="max-width: 560px; margin: 0 auto; text-align: center;">
                ${renderParagraphs(paragraphs)}
              </div>

              ${detailRowsHtml ? `
                <div style="max-width: 540px; margin: 34px auto 0;">
                  <p style="margin: 0 0 18px 0; font-size: 14px; font-weight: 700; text-align: center; color: #374151;">${escapeHtml(sectionTitle || 'Details')}</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                    ${detailRowsHtml}
                  </table>
                </div>
              ` : ''}

              ${note ? `
                <div style="max-width: 540px; margin: 28px auto 0; padding: 16px 18px; border-radius: 18px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 15px; line-height: 1.6; text-align: center;">
                  ${escapeHtml(note)}
                </div>
              ` : ''}

              ${ctaLabel && safeCtaUrl ? `
                <div style="max-width: 540px; margin: 30px auto 0; text-align: center;">
                  <a href="${safeCtaUrl}" target="_blank" rel="noreferrer" style="display: inline-block; padding: 14px 30px; border-radius: 999px; background: ${escapeHtml(accentColor)}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.01em;">${escapeHtml(ctaLabel)}</a>
                  <p style="margin: 18px 0 0 0; font-size: 14px; color: #4b5563; line-height: 1.6;">System URL: <a href="${safeCtaUrl}" target="_blank" rel="noreferrer" style="color: ${escapeHtml(accentColor)}; text-decoration: none; font-weight: 700;">${safeCtaUrl}</a></p>
                </div>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 24px 0; text-align: center; font-size: 12px; line-height: 1.6; color: #6b7280;">
              ${escapeHtml(footerText)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const buildWelcomeEmailText = ({ recipientName, username, passwordLabel, passwordValue, role, systemUrl, note }) => [
  'Welcome to IC-Lib',
  '',
  `Hello ${recipientName},`,
  'Your account has been created and is ready to use.',
  '',
  `Username: ${username}`,
  `${passwordLabel}: ${passwordValue}`,
  `Role: ${role}`,
  `System URL: ${systemUrl}`,
  note ? `Note: ${note}` : null,
  '',
  'Automated message from IC-Lib. Please do not reply to this email.',
].filter(Boolean).join('\n');

const ECO_EMAIL_VARIANTS = {
  eco_created: {
    eyebrow: 'ECO Submitted',
    title: 'ECO Submitted',
    paragraphs: ['An Engineering Change Order has been submitted and is ready for review.'],
    accentColor: '#2563eb',
    ctaLabel: 'Review ECO',
  },
  eco_approved: {
    eyebrow: 'ECO Approved',
    title: 'ECO Approved',
    paragraphs: ['An Engineering Change Order has been approved and changes have been applied.'],
    accentColor: '#16a34a',
    ctaLabel: 'Open ECO',
  },
  eco_rejected: {
    eyebrow: 'ECO Rejected',
    title: 'ECO Rejected',
    paragraphs: ['An Engineering Change Order has been rejected. Review details below for next action.'],
    accentColor: '#dc2626',
    ctaLabel: 'Review ECO',
  },
  eco_stage_advanced: {
    eyebrow: 'ECO Advanced',
    title: 'ECO Stage Advanced',
    paragraphs: ['An Engineering Change Order advanced to next approval stage.'],
    accentColor: '#7c3aed',
    ctaLabel: 'Open ECO',
  },
  eco_pending_approval: {
    eyebrow: 'Approval Needed',
    title: 'ECO Assigned For Approval',
    paragraphs: ['An Engineering Change Order now needs review and approval.'],
    accentColor: '#d97706',
    ctaLabel: 'Review ECO',
  },
};

const buildECOEmailRows = (eco, actionType, additionalInfo) => {
  const rows = [
    { label: 'ECO Number', value: eco.eco_number, emphasize: true },
    { label: 'Component', value: `${eco.part_number} - ${eco.component_description || 'No description'}` },
    { label: 'Submitted By', value: eco.initiated_by_name || 'Unknown' },
  ];

  if (actionType === 'eco_approved') {
    rows.push({ label: 'Approved By', value: additionalInfo.approved_by_name || 'Unknown' });
  }

  if (actionType === 'eco_rejected') {
    rows.push({ label: 'Rejected By', value: additionalInfo.rejected_by_name || 'Unknown' });
    rows.push({ label: 'Reason', value: eco.rejection_reason || additionalInfo.rejection_reason || 'No reason provided' });
  }

  if (actionType === 'eco_stage_advanced') {
    rows.push({ label: 'Previous Stage', value: additionalInfo.from_stage || 'Unknown' });
    rows.push({ label: 'Current Stage', value: additionalInfo.to_stage || 'Unknown' });
  }

  if (actionType === 'eco_pending_approval') {
    rows.push({ label: 'Current Stage', value: additionalInfo.to_stage || additionalInfo.stage_name || 'Pending approval' });
    rows.push({ label: 'Assigned To', value: additionalInfo.assigned_to_name || 'Approval queue' });
  }

  if (eco.notes) {
    rows.push({ label: 'Notes', value: eco.notes });
  }

  return rows;
};

const buildECOEmailText = (eco, actionType, additionalInfo) => {
  const variant = ECO_EMAIL_VARIANTS[actionType] || ECO_EMAIL_VARIANTS.eco_created;
  const detailLines = buildECOEmailRows(eco, actionType, additionalInfo)
    .map(({ label, value }) => `${label}: ${value}`);

  return [
    variant.title,
    '',
    ...variant.paragraphs,
    '',
    ...detailLines,
    '',
    `View ECO: ${getConfiguredBaseUrl()}/eco`,
    '',
    'Automated notification from IC-Lib. Manage email preferences in User Settings.',
  ].join('\n');
};

const TEST_EMAIL_TEMPLATES = {
  system_test: {
    label: 'System test',
    subject: 'IC-Lib Test Email',
    build: () => {
      const systemUrl = getConfiguredBaseUrl();
      return {
        html: renderEmailLayout({
          preheader: 'SMTP configuration test from IC-Lib.',
          eyebrow: 'System Test',
          title: 'Email Delivery Test',
          paragraphs: [
            'SMTP configuration is working and IC-Lib can deliver outbound email.',
            `Generated at ${new Date().toISOString()}.`,
          ],
          sectionTitle: 'Verification',
          rows: [
            { label: 'Status', value: 'Email delivery confirmed', emphasize: true },
            { label: 'Environment', value: process.env.NODE_ENV || 'development' },
          ],
          accentColor: '#2563eb',
          ctaLabel: 'Open IC-Lib',
          ctaUrl: systemUrl,
        }),
        text: [
          'IC-Lib Test Email',
          '',
          'SMTP configuration is working and IC-Lib can deliver outbound email.',
          `Generated at ${new Date().toISOString()}.`,
          '',
          `Open IC-Lib: ${systemUrl}`,
        ].join('\n'),
      };
    },
  },
  eco_submitted: {
    label: 'ECO submitted preview',
    subject: '[Preview] ECO Submitted',
    actionType: 'eco_created',
  },
  eco_approved: {
    label: 'ECO approved preview',
    subject: '[Preview] ECO Approved',
    actionType: 'eco_approved',
    additionalInfo: { approved_by_name: 'Alex Reviewer' },
  },
  eco_rejected: {
    label: 'ECO rejected preview',
    subject: '[Preview] ECO Rejected',
    actionType: 'eco_rejected',
    additionalInfo: { rejected_by_name: 'Alex Reviewer', rejection_reason: 'Specification mismatch' },
  },
  eco_assigned: {
    label: 'ECO assigned preview',
    subject: '[Preview] ECO Assigned',
    actionType: 'eco_pending_approval',
    additionalInfo: { assigned_to_name: 'Admin Approver', to_stage: 'Engineering Review' },
  },
};

const SAMPLE_ECO = {
  eco_number: '24001',
  part_number: 'IC-FT2232H',
  component_description: 'USB FIFO interface controller',
  initiated_by_name: 'Jason Yang',
  notes: 'Package update with refreshed CAD deliverables.',
  rejection_reason: 'Waiting for updated schematic symbol review.',
};

export function getConfiguredBaseUrl() {
  return normalizeBaseUrl(
    process.env.CONFIG_BASE_URL
      || process.env.APP_URL
      || process.env.BASE_DOMAIN
      || DEFAULT_CONFIG_BASE_URL,
  );
}

export function buildWelcomeEmail({ username, role, displayName, password, passwordWasGenerated }) {
  const recipientName = displayName || username;
  const systemUrl = getConfiguredBaseUrl();
  const passwordLabel = passwordWasGenerated ? 'Temporary Password' : 'Password';
  const passwordValue = passwordWasGenerated ? password : 'Set by administrator';
  const note = passwordWasGenerated ? 'Change your password after your first login.' : null;

  return {
    subject: 'Welcome to IC-Lib - Your Account Has Been Created',
    html: renderEmailLayout({
      preheader: 'Your IC-Lib account is ready to use.',
      eyebrow: 'Account Created',
      title: 'Welcome to IC-Lib',
      paragraphs: [
        `Hello ${recipientName},`,
        'Your account has been created and is ready to use.',
      ],
      sectionTitle: 'Account Details',
      rows: [
        { label: 'Username', value: username, emphasize: true },
        { label: passwordLabel, value: passwordValue, emphasize: passwordWasGenerated },
        { label: 'Role', value: formatRoleLabel(role) },
        { label: 'System URL', value: systemUrl },
      ],
      note,
      accentColor: '#2563eb',
      ctaLabel: 'Open IC-Lib',
      ctaUrl: systemUrl,
    }),
    text: buildWelcomeEmailText({
      recipientName,
      username,
      passwordLabel,
      passwordValue,
      role: formatRoleLabel(role),
      systemUrl,
      note,
    }),
  };
}

export function buildECOEmail(eco, actionType, additionalInfo = {}) {
  const variant = ECO_EMAIL_VARIANTS[actionType] || ECO_EMAIL_VARIANTS.eco_created;

  return {
    html: renderEmailLayout({
      preheader: variant.title,
      eyebrow: variant.eyebrow,
      title: variant.title,
      paragraphs: variant.paragraphs,
      sectionTitle: 'ECO Details',
      rows: buildECOEmailRows(eco, actionType, additionalInfo),
      accentColor: variant.accentColor,
      ctaLabel: variant.ctaLabel,
      ctaUrl: `${getConfiguredBaseUrl()}/eco`,
      footerText: 'Automated notification from IC-Lib. Manage email preferences in User Settings.',
    }),
    text: buildECOEmailText(eco, actionType, additionalInfo),
  };
}

export function buildPreviewEmail(templateType = 'system_test') {
  const template = TEST_EMAIL_TEMPLATES[templateType] || TEST_EMAIL_TEMPLATES.system_test;

  if (template.build) {
    return {
      label: template.label,
      subject: template.subject,
      ...template.build(),
    };
  }

  const { html, text } = buildECOEmail(
    SAMPLE_ECO,
    template.actionType,
    template.additionalInfo || {},
  );

  return {
    label: template.label,
    subject: template.subject,
    html,
    text,
  };
}

/**
 * Encrypt a string using AES-256-CBC
 */
export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a string encrypted with AES-256-CBC
 */
export function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error decrypting: ${error.message}`);
    return null;
  }
}

/**
 * Get SMTP settings from database
 */
export async function getSMTPSettings() {
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error getting SMTP settings: ${error.message}`);
    return null;
  }
}

/**
 * Create nodemailer transporter from SMTP settings
 */
export async function createTransporter() {
  const settings = await getSMTPSettings();
  if (!settings || !settings.enabled) {
    return null;
  }

  const transportConfig = {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    // Allow self-signed/expired certificates for open relay servers
    tls: {
      rejectUnauthorized: false,
    },
    // Connection timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000,
  };

  if (!settings.no_auth && settings.auth_user) {
    transportConfig.auth = {
      user: settings.auth_user,
      pass: decrypt(settings.auth_password_encrypted),
    };
  }

  return nodemailer.createTransport(transportConfig);
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured or disabled, skipping email');
    return { success: false, reason: 'SMTP not configured' };
  }

  const settings = await getSMTPSettings();

  try {
    const info = await transporter.sendMail({
      from: `"${settings.from_name}" <${settings.from_address}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    // Log the email
    await pool.query(`
      INSERT INTO email_log (recipient_email, subject, template_name, status)
      VALUES ($1, $2, $3, 'sent')
    `, [to, subject, 'generic']);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[EmailService]\x1b[0m Email sent to ${to}: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Failed to send email to ${to}: ${error.message}`);

    // Log the failure
    await pool.query(`
      INSERT INTO email_log (recipient_email, subject, template_name, status, error_message)
      VALUES ($1, $2, $3, 'failed', $4)
    `, [to, subject, 'generic', error.message]);

    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail({ to, username, role, displayName, password, passwordWasGenerated }) {
  const { subject, html, text } = buildWelcomeEmail({
    username,
    role,
    displayName,
    password,
    passwordWasGenerated,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection() {
  const transporter = await createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured or disabled' };
  }

  try {
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get users who should receive ECO notifications
 */
async function getECONotificationRecipients(notificationType) {
  try {
    // Map notification type to column name
    const columnMap = {
      'eco_created': 'notify_eco_created',
      'eco_approved': 'notify_eco_approved',
      'eco_rejected': 'notify_eco_rejected',
      'eco_pending_approval': 'notify_eco_pending_approval',
      'eco_stage_advanced': 'notify_eco_stage_advanced',
    };

    const column = columnMap[notificationType];
    if (!column) return [];

    // For pending approval notifications, only get users who can approve
    let query = `
      SELECT u.id, u.email, u.username, u.role
      FROM users u
      LEFT JOIN email_notification_preferences enp ON u.id = enp.user_id
      WHERE u.email IS NOT NULL
        AND u.role <> 'read-only'
        AND enp.${column} = true
    `;

    if (notificationType === 'eco_pending_approval') {
      query += ' AND u.role IN (\'admin\', \'approver\')';
    }

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error getting ECO notification recipients: ${error.message}`);
    return [];
  }
}

/**
 * Send ECO notification emails
 */
export async function sendECONotification(eco, actionType, additionalInfo = {}) {
  // Check if SMTP is configured
  const settings = await getSMTPSettings();
  if (!settings || !settings.enabled) {
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured, skipping ECO notification');
    return;
  }

  // Get recipients based on action type
  const recipients = await getECONotificationRecipients(actionType);
  if (recipients.length === 0) {
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m No recipients for ECO notification');
    return;
  }

  // Generate email content
  const subjects = {
    'eco_created': `[${eco.eco_number}] New Engineering Change Order Created`,
    'eco_approved': `[${eco.eco_number}] Engineering Change Order Approved`,
    'eco_rejected': `[${eco.eco_number}] Engineering Change Order Rejected`,
    'eco_pending_approval': `[${eco.eco_number}] Engineering Change Order Assigned For Approval`,
    'eco_stage_advanced': `[${eco.eco_number}] ECO Advanced to ${additionalInfo.to_stage || 'Next Stage'}`,
  };

  const subject = subjects[actionType] || `ECO Notification: ${eco.eco_number}`;
  const { html, text } = buildECOEmail(eco, actionType, additionalInfo);

  // Send to all recipients
  const results = await Promise.all(
    recipients.map(recipient => 
      sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
      }).then(result => ({
        ...result,
        recipient: recipient.email,
      })),
    ),
  );

  // Log results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[EmailService]\x1b[0m ECO ${actionType} notifications: ${successful} sent, ${failed} failed`);

  // Log to email_log with ECO reference
  for (const result of results) {
    if (result.success) {
      await pool.query(`
        UPDATE email_log 
        SET eco_id = $1 
        WHERE recipient_email = $2 AND subject = $3 
        ORDER BY created_at DESC LIMIT 1
      `, [eco.id, result.recipient, subject]);
    }
  }

  return results;
}

export default {
  encrypt,
  decrypt,
  getConfiguredBaseUrl,
  buildWelcomeEmail,
  buildECOEmail,
  buildPreviewEmail,
  getSMTPSettings,
  createTransporter,
  sendEmail,
  sendWelcomeEmail,
  testSMTPConnection,
  sendECONotification,
};

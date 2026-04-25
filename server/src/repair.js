import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import pool from './config/database.js';

const ADMIN_USERNAME = 'admin';
const PASSWORD_LENGTH = 6;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function writeLine(stream, message) {
  stream.write(`${message}\n`);
}

export function generateRandomPassword(length = PASSWORD_LENGTH, alphabet = PASSWORD_ALPHABET) {
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += alphabet[randomInt(0, alphabet.length)];
  }

  return password;
}

export async function resetAdminPassword({
  db = pool,
  bcryptLib = bcrypt,
  password = generateRandomPassword(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const passwordHash = await bcryptLib.hash(password, 10);
    const result = await db.query(
      `UPDATE users
       SET password_hash = $1
       WHERE username = $2
       RETURNING id`,
      [passwordHash, ADMIN_USERNAME],
    );

    if (result.rowCount === 0) {
      writeLine(stderr, `[ERROR] [Repair] User "${ADMIN_USERNAME}" not found`);
      return 1;
    }

    writeLine(stdout, '[INFO] [Repair] Admin password reset');
    writeLine(stdout, `[INFO] [Repair] New password: ${password}`);
    return 0;
  } catch (error) {
    writeLine(stderr, `[ERROR] [Repair] Failed to reset admin password: ${error.message}`);
    return 1;
  }
}

export const REPAIR_COMMANDS = {
  'admin-reset': resetAdminPassword,
};

export async function runRepairCommand(args = [], deps = {}) {
  const [command] = args;
  const stderr = deps.stderr || process.stderr;

  if (!command) {
    writeLine(stderr, '[ERROR] [Repair] Missing repair command');
    writeLine(stderr, `[INFO] [Repair] Available commands: ${Object.keys(REPAIR_COMMANDS).join(', ')}`);
    return 1;
  }

  const handler = REPAIR_COMMANDS[command];

  if (!handler) {
    writeLine(stderr, `[ERROR] [Repair] Unknown repair command: ${command}`);
    writeLine(stderr, `[INFO] [Repair] Available commands: ${Object.keys(REPAIR_COMMANDS).join(', ')}`);
    return 1;
  }

  return handler(deps);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const exitCode = await runRepairCommand(process.argv.slice(2));
  await pool.end();
  process.exit(exitCode);
}
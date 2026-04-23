import { describe, expect, it } from 'vitest';

import {
  compareMigrationFilenames,
  parseMigrationFilename,
} from '../services/migrationNaming.js';

describe('migrationNaming', () => {
  it('parses numeric migrations', () => {
    expect(parseMigrationFilename('2_schema_version_tracking_update.sql')).toEqual({
      sequenceNumber: 2,
      description: 'schema version tracking update',
    });
  });

  it('still parses older zero-padded migration filenames numerically', () => {
    expect(parseMigrationFilename('001_legacy_schema_repairs.sql')).toEqual({
      sequenceNumber: 1,
      description: 'legacy schema repairs',
    });
  });

  it('sorts numeric migrations by integer sequence', () => {
    const filenames = [
      '10_post_release_fix.sql',
      '2_schema_version_tracking_update.sql',
      '1_legacy_schema_repairs.sql',
    ];

    expect(filenames.sort(compareMigrationFilenames)).toEqual([
      '1_legacy_schema_repairs.sql',
      '2_schema_version_tracking_update.sql',
      '10_post_release_fix.sql',
    ]);
  });
});
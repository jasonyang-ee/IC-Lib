import { describe, expect, it } from 'vitest';

import packageSamples from '../../../scratchpad/package-samples.json';
import * as clientNaming from '../utils/packageNaming';
import * as serverNaming from '../../../server/src/utils/packageNaming.js';

const catalog = [
  { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
  { short_name: 'VQFN', count_policy: 'append', aliases: [{ alias: 'VQFN' }] },
  { short_name: 'VFQFN', count_policy: 'append', aliases: [{ alias: 'VFQFN' }] },
  { short_name: 'TSOT-23-5', count_policy: 'embedded', aliases: [{ alias: 'TSOT-23-5' }, { alias: 'SOT-23-5 Thin' }] },
  { short_name: 'SOT-23-5', count_policy: 'embedded', aliases: [{ alias: 'SOT-23-5' }, { alias: 'SC-74A' }, { alias: 'SOT-753' }] },
  { short_name: 'DPAK', count_policy: 'none', aliases: [{ alias: 'DPAK' }, { alias: 'TO-252' }] },
  { short_name: 'QFN', count_policy: 'append', aliases: [{ alias: 'QFN' }] },
  { short_name: 'TSSOP', count_policy: 'append', aliases: [{ alias: 'TSSOP' }] },
];

describe('packageNaming client mirror', () => {
  it.each(packageSamples)('matches the server for $input', ({ input }) => {
    expect(clientNaming.parsePackageInput(input, catalog)).toEqual(serverNaming.parsePackageInput(input, catalog));
  });
});

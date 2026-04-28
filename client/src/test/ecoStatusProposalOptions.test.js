import { describe, expect, it } from 'vitest';
import { getEcoStatusProposalOptions } from '../utils/ecoStatusProposalOptions';

describe('getEcoStatusProposalOptions', () => {
  it('only allows new parts to propose prototype through ECO', () => {
    expect(getEcoStatusProposalOptions('new')).toEqual([
      { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
    ]);
  });

  it('allows production parts to be proposed back to prototype', () => {
    expect(getEcoStatusProposalOptions('production')).toEqual([
      { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
      { newValue: 'archived', label: 'Propose Archive', tone: 'archived' },
    ]);
  });

  it('allows archived parts to move back to prototype or production', () => {
    expect(getEcoStatusProposalOptions('archived')).toEqual([
      { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
      { newValue: 'production', label: 'Propose Production', tone: 'production' },
    ]);
  });

  it('returns no options for unknown statuses', () => {
    expect(getEcoStatusProposalOptions('unexpected')).toEqual([]);
  });
});

const STATUS_PROPOSAL_OPTIONS = Object.freeze({
  new: [
    { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
    { newValue: 'archived', label: 'Propose Archive', tone: 'archived' },
  ],
  reviewing: [
    { newValue: 'archived', label: 'Propose Archive', tone: 'archived' },
  ],
  prototype: [
    { newValue: 'production', label: 'Propose Production', tone: 'production' },
    { newValue: 'archived', label: 'Propose Archive', tone: 'archived' },
  ],
  production: [
    { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
    { newValue: 'archived', label: 'Propose Archive', tone: 'archived' },
  ],
  archived: [
    { newValue: 'prototype', label: 'Propose Prototype', tone: 'prototype' },
    { newValue: 'production', label: 'Propose Production', tone: 'production' },
  ],
});

export const getEcoStatusProposalOptions = (approvalStatus) => (
  STATUS_PROPOSAL_OPTIONS[approvalStatus] || []
);

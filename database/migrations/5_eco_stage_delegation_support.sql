-- Add delegated ECO approval support and track the assigned approver slot represented by each vote.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS delegation UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE eco_approvals
    ADD COLUMN IF NOT EXISTS acting_for_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE eco_approvals
    DROP CONSTRAINT IF EXISTS unique_vote_per_stage;

DROP INDEX IF EXISTS idx_eco_approvals_effective_vote;

CREATE INDEX IF NOT EXISTS idx_eco_approvals_user ON eco_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_eco_approvals_acting_for ON eco_approvals(acting_for_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_approvals_effective_vote
    ON eco_approvals (eco_id, stage_id, (COALESCE(acting_for_user_id, user_id)));
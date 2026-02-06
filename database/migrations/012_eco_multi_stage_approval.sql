-- Migration: Multi-stage ECO approval workflow
-- Adds configurable approval stages and per-stage approval tracking

-- ============================================================================
-- Table: eco_approval_stages
-- Defines the approval pipeline (configurable stages in order)
-- ============================================================================
CREATE TABLE IF NOT EXISTS eco_approval_stages (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 1,
    required_role VARCHAR(50) NOT NULL DEFAULT 'approver',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_stage_order UNIQUE(stage_order)
);

-- Trigger for updated_at
CREATE TRIGGER update_eco_approval_stages_updated_at
    BEFORE UPDATE ON eco_approval_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: eco_approvals
-- Tracks individual approval/rejection votes per ECO per stage
-- ============================================================================
CREATE TABLE IF NOT EXISTS eco_approvals (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    eco_id UUID NOT NULL REFERENCES eco_orders(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES eco_approval_stages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_approval_decision CHECK (decision IN ('approved', 'rejected')),
    CONSTRAINT unique_vote_per_stage UNIQUE(eco_id, stage_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eco_approvals_eco ON eco_approvals(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_approvals_stage ON eco_approvals(stage_id);

-- ============================================================================
-- Add current_stage_id to eco_orders for tracking progress
-- ============================================================================
ALTER TABLE eco_orders ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES eco_approval_stages(id);

-- Update the status CHECK constraint to allow 'in_review'
ALTER TABLE eco_orders DROP CONSTRAINT IF EXISTS check_eco_status;
ALTER TABLE eco_orders ADD CONSTRAINT check_eco_status
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected'));

-- ============================================================================
-- Add email notification preference for stage advancement
-- ============================================================================
ALTER TABLE email_notification_preferences
    ADD COLUMN IF NOT EXISTS notify_eco_stage_advanced BOOLEAN DEFAULT true;

-- ============================================================================
-- Insert default approval stage (backward compatible with single-approval)
-- ============================================================================
INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals, required_role)
SELECT 'Review & Approval', 1, 1, 'approver'
WHERE NOT EXISTS (SELECT 1 FROM eco_approval_stages);

-- Set current_stage_id for existing pending ECOs
UPDATE eco_orders
SET current_stage_id = (
    SELECT id FROM eco_approval_stages
    WHERE is_active = true
    ORDER BY stage_order ASC
    LIMIT 1
)
WHERE status = 'pending' AND current_stage_id IS NULL;

-- ============================================================================
-- Update eco_orders_full view to include stage info
-- ============================================================================
CREATE OR REPLACE VIEW eco_orders_full AS
SELECT
    eo.*,
    u1.username as initiated_by_name,
    u2.username as approved_by_name,
    c.part_number as component_part_number,
    c.description as component_description,
    cc.name as category_name,
    m.name as manufacturer_name,
    eas.stage_name as current_stage_name,
    eas.stage_order as current_stage_order,
    eas.required_approvals as current_stage_required_approvals
FROM eco_orders eo
LEFT JOIN users u1 ON eo.initiated_by = u1.id
LEFT JOIN users u2 ON eo.approved_by = u2.id
LEFT JOIN components c ON eo.component_id = c.id
LEFT JOIN component_categories cc ON c.category_id = cc.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN eco_approval_stages eas ON eo.current_stage_id = eas.id
ORDER BY eo.id DESC;

-- Schema version
INSERT INTO schema_version (version, description) VALUES (12, 'Multi-stage ECO approval workflow');

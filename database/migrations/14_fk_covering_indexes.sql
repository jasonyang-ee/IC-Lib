-- Migration 14: covering indexes for FK columns that lacked them (live-DB audit DB2)
-- Target release: next after 1.10.0 (see CHANGELOG.md Unreleased)
-- Cheap at current data size; protects cascade-delete and JOIN scans as data grows.
-- Mirrored in init-schema.sql / init-users.sql / init-smtp.sql for fresh installs.

CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_users_delegation ON users(delegation);
CREATE INDEX IF NOT EXISTS idx_components_approval_user ON components(approval_user_id);
CREATE INDEX IF NOT EXISTS idx_eco_orders_initiated_by ON eco_orders(initiated_by);
CREATE INDEX IF NOT EXISTS idx_eco_orders_approved_by ON eco_orders(approved_by);
CREATE INDEX IF NOT EXISTS idx_eco_distributors_alternative ON eco_distributors(alternative_id);
CREATE INDEX IF NOT EXISTS idx_eco_distributors_distributor ON eco_distributors(distributor_id);
CREATE INDEX IF NOT EXISTS idx_eco_alternative_parts_alternative ON eco_alternative_parts(alternative_id);
CREATE INDEX IF NOT EXISTS idx_eco_alternative_parts_manufacturer ON eco_alternative_parts(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_eco_specifications_category_spec ON eco_specifications(category_spec_id);
CREATE INDEX IF NOT EXISTS idx_smtp_settings_updated_by ON smtp_settings(updated_by);

-- Remove legacy CIS views replaced by production_parts and prototype_parts.
DROP VIEW IF EXISTS active_parts;
DROP VIEW IF EXISTS new_parts;
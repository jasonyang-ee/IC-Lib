-- Migration: Fix foreign key constraint for category change
-- The components_alternative.part_number FK needs ON UPDATE CASCADE to allow part number changes
-- Date: 2025-02-XX

-- Drop the existing foreign key constraint
ALTER TABLE components_alternative
DROP CONSTRAINT IF EXISTS components_alternative_part_number_fkey;

-- Re-add the foreign key with ON UPDATE CASCADE
ALTER TABLE components_alternative
ADD CONSTRAINT components_alternative_part_number_fkey
FOREIGN KEY (part_number) REFERENCES components(part_number)
ON DELETE CASCADE
ON UPDATE CASCADE;

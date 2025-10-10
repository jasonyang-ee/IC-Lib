-- ============================================================================
-- Migration Script: Update part_type to include category name
-- ============================================================================
-- This script updates the part_type generated column to include the main
-- category name along with subcategories
-- Format: "CategoryName/Sub1/Sub2/Sub3"
-- ============================================================================

-- Step 1: Drop the existing generated column
ALTER TABLE components DROP COLUMN IF EXISTS part_type;

-- Step 2: Re-create the column with the new definition
ALTER TABLE components ADD COLUMN part_type VARCHAR(500) GENERATED ALWAYS AS (
    CASE 
        WHEN category_id IS NOT NULL THEN
            (SELECT name FROM component_categories WHERE id = category_id) ||
            CASE 
                WHEN sub_category1 IS NOT NULL THEN 
                    '/' || sub_category1 || 
                    COALESCE('/' || sub_category2, '') ||
                    COALESCE('/' || sub_category3, '')
                ELSE ''
            END
        ELSE NULL
    END
) STORED;

-- Step 3: Verify the change
SELECT 
    part_number,
    (SELECT name FROM component_categories WHERE id = category_id) as category,
    sub_category1,
    sub_category2,
    sub_category3,
    part_type
FROM components
LIMIT 10;

-- ============================================================================
-- Expected Results:
-- Before: part_type = "Thick Film/±1%/0.1W"
-- After:  part_type = "Resistors/Thick Film/±1%/0.1W"
-- ============================================================================

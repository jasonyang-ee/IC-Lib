-- Choose the block for your RDBMS and run it. This file contains multiple dialects; keep only the block you need.

-- ====================
-- PostgreSQL (public schema)
-- ====================
-- Drops all tables in the "public" schema
DO
$$
DECLARE
	r RECORD;
BEGIN
	FOR r IN
		SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
	LOOP
		EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', current_schema(), r.tablename);
	END LOOP;
END;
$$;


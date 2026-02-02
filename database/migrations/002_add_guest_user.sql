-- Migration: Add guest user with read-only access
-- This migration adds a default guest user for viewing the system without write permissions

-- Insert guest user if not exists
-- Password: guest123 (Read-only access for viewing)
-- This is bcrypt hash for "guest123" with salt rounds 10
INSERT INTO users (username, password_hash, role, display_name, is_active) 
VALUES ('guest', '$2a$10$G8viUMs5vl8vvm6EOLaoFutUTyqabBRcLYB4c8TcmDBe7mAmxQyra', 'read-only', 'Guest User', true)
ON CONFLICT (username) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash, 
  role = 'read-only',
  display_name = EXCLUDED.display_name,
  is_active = true;

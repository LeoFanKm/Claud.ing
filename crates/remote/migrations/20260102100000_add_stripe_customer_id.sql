-- Add Stripe customer ID to user_settings
-- Links users to their Stripe customer account for billing

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_user_settings_stripe_customer_id
ON user_settings (stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

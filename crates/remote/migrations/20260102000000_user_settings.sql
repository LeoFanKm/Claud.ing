-- User Settings Table
-- Stores per-user preferences that can be synced across devices

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'SYSTEM' CHECK (theme IN ('LIGHT', 'DARK', 'SYSTEM')),
    language TEXT NOT NULL DEFAULT 'EN',
    notifications JSONB NOT NULL DEFAULT '{"sound_enabled": true, "push_enabled": false}',
    analytics_enabled BOOLEAN NOT NULL DEFAULT false,
    pr_auto_description_enabled BOOLEAN NOT NULL DEFAULT false,
    pr_auto_description_prompt TEXT,
    git_branch_prefix TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);

-- Trigger for updated_at
CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

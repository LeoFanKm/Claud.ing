-- Task Sessions Table
-- Stores sessions for shared tasks (execution contexts)

DO $$
BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS task_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES shared_tasks(id) ON DELETE CASCADE,
    executor TEXT,
    name TEXT,
    status session_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for task lookup
CREATE INDEX IF NOT EXISTS idx_task_sessions_task_id ON task_sessions (task_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_task_sessions_status ON task_sessions (status);

-- Composite index for task + status queries
CREATE INDEX IF NOT EXISTS idx_task_sessions_task_status ON task_sessions (task_id, status);

-- Trigger for updated_at
CREATE TRIGGER set_task_sessions_updated_at
    BEFORE UPDATE ON task_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

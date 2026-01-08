/**
 * @file cache.rs
 * @description Cache layer for auth middleware - provides cached access to users and sessions
 *
 * @input User ID or Session ID (Uuid)
 * @output Cached User or AuthSession data
 * @position crates/remote/src/cache
 *
 * @lastModified 2026-01-05
 */

use sqlx::PgPool;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::{
    db::{
        auth::{AuthSession, AuthSessionError, AuthSessionRepository},
        identity_errors::IdentityError,
        users::{User, UserRepository},
    },
    state::StringCache,
};

/// Cache key prefixes
const USER_CACHE_PREFIX: &str = "user:";
const SESSION_CACHE_PREFIX: &str = "session:";

/// Generate cache key for user
fn user_cache_key(user_id: Uuid) -> String {
    format!("{}{}", USER_CACHE_PREFIX, user_id)
}

/// Generate cache key for session
fn session_cache_key(session_id: Uuid) -> String {
    format!("{}{}", SESSION_CACHE_PREFIX, session_id)
}

/// Get user with cache-first pattern.
/// Returns cached user if available, otherwise fetches from DB and caches the result.
pub async fn get_user_cached(
    pool: &PgPool,
    cache: &StringCache,
    user_id: Uuid,
) -> Result<User, IdentityError> {
    let cache_key = user_cache_key(user_id);

    // Try cache first
    if let Some(cached) = cache.get(&cache_key).await {
        match serde_json::from_str::<User>(&cached) {
            Ok(user) => {
                debug!(user_id = %user_id, "user cache hit");
                return Ok(user);
            }
            Err(e) => {
                warn!(user_id = %user_id, error = ?e, "failed to deserialize cached user, fetching from DB");
                cache.invalidate(&cache_key).await;
            }
        }
    }

    // Cache miss - fetch from DB
    debug!(user_id = %user_id, "user cache miss, fetching from DB");
    let user_repo = UserRepository::new(pool);
    let user = user_repo.fetch_user(user_id).await?;

    // Cache the result
    match serde_json::to_string(&user) {
        Ok(serialized) => {
            cache.insert(cache_key, serialized).await;
        }
        Err(e) => {
            warn!(user_id = %user_id, error = ?e, "failed to serialize user for cache");
        }
    }

    Ok(user)
}

/// Get session with cache-first pattern.
/// Returns cached session if available, otherwise fetches from DB and caches the result.
pub async fn get_session_cached(
    pool: &PgPool,
    cache: &StringCache,
    session_id: Uuid,
) -> Result<AuthSession, AuthSessionError> {
    let cache_key = session_cache_key(session_id);

    // Try cache first
    if let Some(cached) = cache.get(&cache_key).await {
        match serde_json::from_str::<AuthSession>(&cached) {
            Ok(session) => {
                debug!(session_id = %session_id, "session cache hit");
                return Ok(session);
            }
            Err(e) => {
                warn!(session_id = %session_id, error = ?e, "failed to deserialize cached session, fetching from DB");
                cache.invalidate(&cache_key).await;
            }
        }
    }

    // Cache miss - fetch from DB
    debug!(session_id = %session_id, "session cache miss, fetching from DB");
    let session_repo = AuthSessionRepository::new(pool);
    let session = session_repo.get(session_id).await?;

    // Cache the result
    match serde_json::to_string(&session) {
        Ok(serialized) => {
            cache.insert(cache_key, serialized).await;
        }
        Err(e) => {
            warn!(session_id = %session_id, error = ?e, "failed to serialize session for cache");
        }
    }

    Ok(session)
}

/// Invalidate user cache entry.
/// Call this when user data is updated.
pub async fn invalidate_user_cache(cache: &StringCache, user_id: Uuid) {
    let cache_key = user_cache_key(user_id);
    cache.invalidate(&cache_key).await;
    debug!(user_id = %user_id, "invalidated user cache");
}

/// Invalidate session cache entry.
/// Call this when session is revoked or updated.
pub async fn invalidate_session_cache(cache: &StringCache, session_id: Uuid) {
    let cache_key = session_cache_key(session_id);
    cache.invalidate(&cache_key).await;
    debug!(session_id = %session_id, "invalidated session cache");
}

/// Invalidate all sessions for a user.
/// Note: This only invalidates by known session IDs, not by user_id prefix.
/// For bulk invalidation, sessions should be tracked or use cache TTL.
pub async fn invalidate_user_sessions(cache: &StringCache, session_ids: &[Uuid]) {
    for session_id in session_ids {
        invalidate_session_cache(cache, *session_id).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_generation() {
        let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let session_id = Uuid::parse_str("660e8400-e29b-41d4-a716-446655440001").unwrap();

        assert_eq!(
            user_cache_key(user_id),
            "user:550e8400-e29b-41d4-a716-446655440000"
        );
        assert_eq!(
            session_cache_key(session_id),
            "session:660e8400-e29b-41d4-a716-446655440001"
        );
    }
}

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use axum_extra::headers::{Authorization, HeaderMapExt, authorization::Bearer};
use chrono::{DateTime, Utc};
use tracing::warn;
use uuid::Uuid;

use crate::{
    AppState, configure_user_scope,
    cache::{get_session_cached, get_user_cached, invalidate_session_cache},
    db::{
        auth::{AuthSessionError, AuthSessionRepository, MAX_SESSION_INACTIVITY_DURATION},
        identity_errors::IdentityError,
        users::User,
    },
};

#[derive(Clone)]
pub struct RequestContext {
    pub user: User,
    pub session_id: Uuid,
    pub access_token_expires_at: DateTime<Utc>,
}

pub async fn require_session(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let bearer = match req.headers().typed_get::<Authorization<Bearer>>() {
        Some(Authorization(token)) => token.token().to_owned(),
        None => return StatusCode::UNAUTHORIZED.into_response(),
    };

    let jwt = state.jwt();
    let identity = match jwt.decode_access_token(&bearer) {
        Ok(details) => details,
        Err(error) => {
            warn!(?error, "failed to decode access token");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    let pool = state.pool();
    let cache = state.cache();

    // Use cache-first pattern for session lookup
    let session = match get_session_cached(pool, cache, identity.session_id).await {
        Ok(session) => session,
        Err(AuthSessionError::NotFound) => {
            warn!("session `{}` not found", identity.session_id);
            return StatusCode::UNAUTHORIZED.into_response();
        }
        Err(AuthSessionError::Database(error)) => {
            warn!(?error, "failed to load session");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Err(_) => {
            warn!("failed to load session for unknown reason");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    if session.revoked_at.is_some() {
        warn!("session `{}` rejected (revoked)", identity.session_id);
        return StatusCode::UNAUTHORIZED.into_response();
    }

    if session.inactivity_duration(Utc::now()) > MAX_SESSION_INACTIVITY_DURATION {
        warn!(
            "session `{}` expired due to inactivity; revoking",
            identity.session_id
        );
        let session_repo = AuthSessionRepository::new(pool);
        if let Err(error) = session_repo.revoke(session.id).await {
            warn!(?error, "failed to revoke inactive session");
        }
        // Invalidate cache for revoked session
        invalidate_session_cache(cache, session.id).await;
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Use cache-first pattern for user lookup
    let user = match get_user_cached(pool, cache, identity.user_id).await {
        Ok(user) => user,
        Err(IdentityError::NotFound) => {
            warn!("user `{}` missing", identity.user_id);
            return StatusCode::UNAUTHORIZED.into_response();
        }
        Err(IdentityError::Database(error)) => {
            warn!(?error, "failed to load user");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Err(_) => {
            warn!("unexpected error loading user");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    configure_user_scope(user.id, user.username.as_deref(), Some(user.email.as_str()));

    req.extensions_mut().insert(RequestContext {
        user,
        session_id: session.id,
        access_token_expires_at: identity.expires_at,
    });

    // Touch session (update last_used_at) - this doesn't need caching
    let session_repo = AuthSessionRepository::new(pool);
    match session_repo.touch(session.id).await {
        Ok(_) => {}
        Err(error) => warn!(?error, "failed to update session last-used timestamp"),
    }

    next.run(req).await
}

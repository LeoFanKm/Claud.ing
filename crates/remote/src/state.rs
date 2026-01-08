use std::{sync::Arc, time::Duration};

use moka::future::Cache;
use sqlx::PgPool;

use crate::{
    auth::{JwtService, OAuthHandoffService, OAuthTokenValidator, ProviderRegistry},
    config::RemoteServerConfig,
    github_app::GitHubAppService,
    mail::Mailer,
    r2::R2Service,
};

/// Type alias for string-keyed cache with string values
pub type StringCache = Cache<String, String>;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: RemoteServerConfig,
    pub jwt: Arc<JwtService>,
    pub mailer: Arc<dyn Mailer>,
    pub server_public_base_url: String,
    pub http_client: reqwest::Client,
    handoff: Arc<OAuthHandoffService>,
    oauth_token_validator: Arc<OAuthTokenValidator>,
    r2: Option<R2Service>,
    github_app: Option<Arc<GitHubAppService>>,
    /// In-memory cache for frequently accessed data (e.g., GitHub tokens, user info)
    cache: StringCache,
}

impl AppState {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        pool: PgPool,
        config: RemoteServerConfig,
        jwt: Arc<JwtService>,
        handoff: Arc<OAuthHandoffService>,
        oauth_token_validator: Arc<OAuthTokenValidator>,
        mailer: Arc<dyn Mailer>,
        server_public_base_url: String,
        http_client: reqwest::Client,
        r2: Option<R2Service>,
        github_app: Option<Arc<GitHubAppService>>,
    ) -> Self {
        // Initialize cache with 10,000 max entries and 5 minute TTL
        let cache = Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(300))
            .build();

        Self {
            pool,
            config,
            jwt,
            mailer,
            server_public_base_url,
            http_client,
            handoff,
            oauth_token_validator,
            r2,
            github_app,
            cache,
        }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn config(&self) -> &RemoteServerConfig {
        &self.config
    }

    pub fn jwt(&self) -> Arc<JwtService> {
        Arc::clone(&self.jwt)
    }

    pub fn handoff(&self) -> Arc<OAuthHandoffService> {
        Arc::clone(&self.handoff)
    }

    pub fn providers(&self) -> Arc<ProviderRegistry> {
        self.handoff.providers()
    }

    pub fn oauth_token_validator(&self) -> Arc<OAuthTokenValidator> {
        Arc::clone(&self.oauth_token_validator)
    }

    pub fn r2(&self) -> Option<&R2Service> {
        self.r2.as_ref()
    }

    pub fn github_app(&self) -> Option<&GitHubAppService> {
        self.github_app.as_deref()
    }

    /// Get a reference to the in-memory cache
    pub fn cache(&self) -> &StringCache {
        &self.cache
    }
}

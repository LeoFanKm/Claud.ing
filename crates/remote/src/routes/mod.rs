use axum::{
    Router,
    body::Body,
    http::{header, header::HeaderName, HeaderValue, Method, Request, Response},
    middleware::{self, Next},
    routing::get,
};
use tower_http::{
    cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    services::{ServeDir, ServeFile},
    trace::{DefaultOnFailure, DefaultOnResponse, TraceLayer},
};
use tracing::{Level, field};

use crate::{AppState, auth::require_session};

/// Security headers middleware - adds security headers to all responses
async fn security_headers(request: Request<Body>, next: Next) -> Response<Body> {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // Prevent clickjacking
    headers.insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    // Prevent MIME type sniffing
    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    // XSS protection for legacy browsers
    headers.insert(
        HeaderName::from_static("x-xss-protection"),
        HeaderValue::from_static("1; mode=block"),
    );
    // Referrer policy
    headers.insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    response
}

mod electric_proxy;
mod error;
mod github_app;
mod identity;
mod oauth;
pub(crate) mod organization_members;
mod organizations;
mod projects;
mod review;
pub mod tasks;
mod tokens;

pub fn router(state: AppState) -> Router {
    let trace_layer = TraceLayer::new_for_http()
        .make_span_with(|request: &Request<_>| {
            let request_id = request
                .extensions()
                .get::<RequestId>()
                .and_then(|id| id.header_value().to_str().ok());
            let span = tracing::info_span!(
                "http_request",
                method = %request.method(),
                uri = %request.uri(),
                request_id = field::Empty
            );
            if let Some(request_id) = request_id {
                span.record("request_id", field::display(request_id));
            }
            span
        })
        .on_response(DefaultOnResponse::new().level(Level::INFO))
        .on_failure(DefaultOnFailure::new().level(Level::ERROR));

    let v1_public = Router::<AppState>::new()
        .route("/health", get(health))
        .merge(oauth::public_router())
        .merge(organization_members::public_router())
        .merge(tokens::public_router())
        .merge(review::public_router())
        .merge(github_app::public_router());

    let v1_protected = Router::<AppState>::new()
        .merge(identity::router())
        .merge(projects::router())
        .merge(tasks::router())
        .merge(organizations::router())
        .merge(organization_members::protected_router())
        .merge(oauth::protected_router())
        .merge(electric_proxy::router())
        .merge(github_app::protected_router())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_session,
        ));

    let static_dir = "/srv/static";
    let spa =
        ServeDir::new(static_dir).fallback(ServeFile::new(format!("{static_dir}/index.html")));

    Router::<AppState>::new()
        .nest("/v1", v1_public)
        .nest("/v1", v1_protected)
        .fallback_service(spa)
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list([
                    "https://claud.ing".parse().unwrap(),
                    "https://www.claud.ing".parse().unwrap(),
                    "http://localhost:5173".parse().unwrap(),
                    "http://localhost:3000".parse().unwrap(),
                ]))
                .allow_methods(AllowMethods::list([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::PATCH,
                    Method::OPTIONS,
                ]))
                .allow_headers(AllowHeaders::list([
                    header::CONTENT_TYPE,
                    header::AUTHORIZATION,
                    HeaderName::from_static("x-request-id"),
                ]))
                .allow_credentials(true),
        )
        .layer(middleware::from_fn(security_headers))
        .layer(trace_layer)
        .layer(PropagateRequestIdLayer::new(HeaderName::from_static(
            "x-request-id",
        )))
        .layer(SetRequestIdLayer::new(
            HeaderName::from_static("x-request-id"),
            MakeRequestUuid {},
        ))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

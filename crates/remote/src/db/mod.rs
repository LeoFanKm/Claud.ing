pub mod auth;
pub mod github_app;
pub mod identity_errors;
pub mod invitations;
pub mod oauth;
pub mod oauth_accounts;
pub mod organization_members;
pub mod organizations;
pub mod projects;
pub mod reviews;
pub mod tasks;
pub mod users;

use sqlx::{PgPool, Postgres, Transaction, migrate::MigrateError, postgres::PgPoolOptions};

pub(crate) type Tx<'a> = Transaction<'a, Postgres>;

pub(crate) async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}

pub(crate) async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let max_connections: u32 = std::env::var("DATABASE_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(database_url)
        .await
}

pub(crate) async fn ensure_electric_role_password(
    pool: &PgPool,
    password: &str,
) -> Result<(), sqlx::Error> {
    if password.is_empty() {
        return Ok(());
    }

    // PostgreSQL doesn't support parameter binding for ALTER ROLE PASSWORD
    // Use PostgreSQL's quote_literal() function for safe escaping to prevent SQL injection
    let quoted: (String,) = sqlx::query_as("SELECT quote_literal($1)")
        .bind(password)
        .fetch_one(pool)
        .await?;

    let sql = format!("ALTER ROLE electric_sync WITH PASSWORD {}", quoted.0);
    sqlx::query(&sql).execute(pool).await?;

    Ok(())
}

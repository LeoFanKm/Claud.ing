/**
 * Environment-aware logging utility
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.debug('Component mounted');           // Dev only
 *   logger.info('User action', { action });      // Dev only
 *   logger.warn('Deprecated usage');             // Always (for important warnings)
 *   logger.error('Failed to fetch', error);      // Always (for errors)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  /** Whether to include timestamps in log output */
  showTimestamp: boolean;
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether logging is enabled at all */
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Determine if we're in development mode
const isDev = import.meta.env.DEV;

const config: LoggerConfig = {
  showTimestamp: isDev,
  minLevel: isDev ? "debug" : "warn", // Only warn/error in production
  enabled: true,
};

function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

function formatMessage(level: LogLevel, prefix: string, message: string): string {
  const parts: string[] = [];

  if (config.showTimestamp) {
    const now = new Date();
    parts.push(`[${now.toISOString().slice(11, 23)}]`);
  }

  parts.push(`[${level.toUpperCase()}]`);

  if (prefix) {
    parts.push(`[${prefix}]`);
  }

  parts.push(message);

  return parts.join(" ");
}

function createLogger(prefix = "") {
  return {
    /**
     * Debug-level logging - only shown in development
     * Use for detailed information useful during development
     */
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog("debug")) {
        console.log(formatMessage("debug", prefix, message), ...args);
      }
    },

    /**
     * Info-level logging - only shown in development
     * Use for general information about app flow
     */
    info(message: string, ...args: unknown[]): void {
      if (shouldLog("info")) {
        console.info(formatMessage("info", prefix, message), ...args);
      }
    },

    /**
     * Warn-level logging - shown in production
     * Use for deprecations, unexpected states that are handled
     */
    warn(message: string, ...args: unknown[]): void {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", prefix, message), ...args);
      }
    },

    /**
     * Error-level logging - shown in production
     * Use for errors and failed operations
     */
    error(message: string, ...args: unknown[]): void {
      if (shouldLog("error")) {
        console.error(formatMessage("error", prefix, message), ...args);
      }
    },

    /**
     * Create a scoped logger with a specific prefix
     */
    scope(newPrefix: string) {
      const combinedPrefix = prefix ? `${prefix}:${newPrefix}` : newPrefix;
      return createLogger(combinedPrefix);
    },
  };
}

/**
 * Default logger instance
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/logger';
 *
 * // Basic usage
 * logger.debug('Component mounted');
 * logger.info('User clicked button', { buttonId: 'submit' });
 * logger.warn('Deprecated API usage');
 * logger.error('Failed to fetch data', error);
 *
 * // Scoped logger for a specific module
 * const authLogger = logger.scope('Auth');
 * authLogger.info('User logged in'); // [INFO] [Auth] User logged in
 * ```
 */
export const logger = createLogger();

/**
 * Create a scoped logger for a specific module/component
 *
 * @example
 * ```ts
 * import { createScopedLogger } from '@/lib/logger';
 *
 * const log = createScopedLogger('ConfigProvider');
 * log.debug('Loading config...'); // [DEBUG] [ConfigProvider] Loading config...
 * ```
 */
export function createScopedLogger(scope: string) {
  return createLogger(scope);
}

/**
 * Temporarily enable/disable all logging
 */
export function setLoggingEnabled(enabled: boolean): void {
  config.enabled = enabled;
}

/**
 * Set the minimum log level
 */
export function setMinLogLevel(level: LogLevel): void {
  config.minLevel = level;
}

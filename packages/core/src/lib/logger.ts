/**
 * Structured JSON logger with level filtering.
 *
 * Outputs JSON objects to the appropriate console method based on log level.
 * Level is controlled by the FORGE_LOG_LEVEL env var (default: 'info').
 *
 * Log levels (in order of severity):
 *   debug < info < warn < error
 *
 * Setting FORGE_LOG_LEVEL=debug enables all levels.
 * Setting FORGE_LOG_LEVEL=warn suppresses debug and info.
 */

/** Supported log levels, ordered from most to least verbose. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function isValidLevel(level: string): level is LogLevel {
  return level in LEVEL_ORDER
}

/**
 * Structured JSON logger with level filtering.
 *
 * Outputs JSON objects to the appropriate console method based on log level.
 * Level hierarchy: debug < info < warn < error.
 * Messages below the configured level are suppressed.
 */
export class Logger {
  private level: LogLevel
  private levelNum: number

  constructor(level?: LogLevel | string) {
    if (level && isValidLevel(level)) {
      this.level = level
    } else {
      this.level = 'info'
    }
    this.levelNum = LEVEL_ORDER[this.level]
  }

  /** Current configured log level. */
  getLevel(): LogLevel {
    return this.level
  }

  /** Log at debug level. Suppressed when level >= info. Uses console.debug. */
  debug(fields: Record<string, unknown>): void {
    if (this.levelNum > LEVEL_ORDER.debug) return
    console.debug(JSON.stringify({ level: 'debug', ts: new Date().toISOString(), ...fields }))
  }

  /** Log at info level. Suppressed when level >= warn. Uses console.log. */
  info(fields: Record<string, unknown>): void {
    if (this.levelNum > LEVEL_ORDER.info) return
    console.log(JSON.stringify({ level: 'info', ts: new Date().toISOString(), ...fields }))
  }

  /** Log at warn level. Suppressed when level >= error. Uses console.warn. */
  warn(fields: Record<string, unknown>): void {
    if (this.levelNum > LEVEL_ORDER.warn) return
    console.warn(JSON.stringify({ level: 'warn', ts: new Date().toISOString(), ...fields }))
  }

  /** Log at error level. Never suppressed (highest level). Uses console.error. */
  error(fields: Record<string, unknown>): void {
    // error is never filtered (highest level)
    console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), ...fields }))
  }
}

// ---------------------------------------------------------------------------
// Singleton — initialized from FORGE_LOG_LEVEL env var
// ---------------------------------------------------------------------------

const envLevel = (typeof process !== 'undefined' && process.env?.FORGE_LOG_LEVEL) || 'info'
export const logger = new Logger(envLevel)

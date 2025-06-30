enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level
  }

  setLevel(level: LogLevel) {
    this.level = level
  }

  debug(...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args)
    }
  }

  info(...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log('[INFO]', ...args)
    }
  }

  warn(...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn('[WARN]', ...args)
    }
  }

  error(...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error('[ERROR]', ...args)
    }
  }
}

// Create a singleton instance of the logger with INFO level to reduce console noise
const logger = new Logger(LogLevel.INFO)

export { logger, LogLevel }

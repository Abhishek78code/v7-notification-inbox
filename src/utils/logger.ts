/**
 * Structured logger utility.
 * Formats log entries as structured JSON objects for easy ingestion into log aggregators (e.g. Datadog, CloudWatch).
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

class StructuredLogger {
  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {}),
    };
    return JSON.stringify(payload);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    console.log(this.format('info', message, context));
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.format('warn', message, context));
  }

  public error(message: string, context?: Record<string, unknown>): void {
    console.error(this.format('error', message, context));
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('debug', message, context));
    }
  }
}

export const logger = new StructuredLogger();

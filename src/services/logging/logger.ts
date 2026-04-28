import type { LogLevel, NamespaceConfig } from './types';
import { registerNamespace, isConsoleEnabled } from './registry';

// ── Console method map ────────────────────────────────────────────────────────

const CONSOLE_METHODS: Record<LogLevel, (...a: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ── Logger class ──────────────────────────────────────────────────────────────

export class Logger {
  readonly namespace: string;

  constructor(namespace: string, config: NamespaceConfig) {
    this.namespace = namespace;
    registerNamespace(namespace, config);
  }

  private _emit(level: LogLevel, message: string, args: unknown[]): void {
    if (isConsoleEnabled(this.namespace)) {
      CONSOLE_METHODS[level](`[${this.namespace}]`, message, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this._emit('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this._emit('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this._emit('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this._emit('error', message, args);
  }
}

/**
 * Factory — creates a named Logger and registers it with the registry.
 *
 * @param namespace  Unique dotted name, e.g. 'stress.trie', 'ml.worker'
 * @param config     Namespace options (ui visibility, initial enabled state)
 */
export function createLogger(namespace: string, config: NamespaceConfig): Logger {
  return new Logger(namespace, config);
}

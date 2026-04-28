/**
 * Logging registry — reactive singleton that controls all loggers.
 *
 * Activation rules (evaluated in order):
 *   1. In dev:  globally ON by default.
 *   2. In prod: globally OFF by default — activate by running in devtools:
 *                  localStorage.setItem('vsDebug', '1'); location.reload();
 *              Or by URL param: ?vsDebug=1 (one-time, does NOT persist)
 *   3. Per-namespace override always wins regardless of global.
 *
 * The registry is a plain `reactive()` object (no Pinia) so it can be
 * imported anywhere — including before the Vue app is mounted — without
 * triggering "getActivePinia was called with no active Pinia".
 */
import { reactive, readonly, computed } from 'vue';
import type { NamespaceConfig } from './types';

// ── Activation ────────────────────────────────────────────────────────────────

function resolveInitialEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  // Prod: check localStorage or one-time URL param
  try {
    if (localStorage.getItem('vsDebug') === '1') return true;
  } catch {
    // localStorage may be blocked (private browsing, etc.)
  }
  const url = new URL(location.href);
  return url.searchParams.get('vsDebug') === '1';
}

// ── State ─────────────────────────────────────────────────────────────────────

const _state = reactive({
  /** Master on/off switch. */
  globalEnabled: resolveInitialEnabled(),
  /** Per-namespace config. Keyed by namespace string. */
  namespaces: {} as Record<string, NamespaceConfig>,
});

// ── Public API ─────────────────────────────────────────────────────────────────

/** Reactive global enabled flag. */
export const globalEnabled = computed({
  get: () => _state.globalEnabled,
  set: (v: boolean) => {
    _state.globalEnabled = v;
  },
});

/**
 * Register a namespace. Call once, at module load time.
 * Re-registration is a no-op if the namespace already exists.
 */
export function registerNamespace(namespace: string, config: NamespaceConfig): void {
  if (_state.namespaces[namespace]) return;
  _state.namespaces[namespace] = config;
}

/** Reactive snapshot of all namespace configs — bind in control panel. */
export const namespaces = readonly(_state.namespaces);

/** Enable a specific namespace (console + UI if configured). */
export function enableNamespace(namespace: string): void {
  const cfg = _state.namespaces[namespace];
  if (cfg) cfg.enabled = true;
}

/** Disable a specific namespace. */
export function disableNamespace(namespace: string): void {
  const cfg = _state.namespaces[namespace];
  if (cfg) cfg.enabled = false;
}

/** Toggle the global master switch. */
export function setGlobalEnabled(enabled: boolean): void {
  _state.globalEnabled = enabled;
  try {
    if (enabled) localStorage.setItem('vsDebug', '1');
    else localStorage.removeItem('vsDebug');
  } catch {
    // ignore
  }
}

/**
 * Determine whether a namespace should emit to console.
 * Per-namespace `enabled` overrides the global switch.
 */
export function isConsoleEnabled(namespace: string): boolean {
  const cfg = _state.namespaces[namespace];
  if (cfg?.enabled !== undefined) return cfg.enabled;
  return _state.globalEnabled;
}

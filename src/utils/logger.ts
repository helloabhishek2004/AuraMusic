type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Default to error-only in production; enable more via setLevel in dev
let currentLevel = LEVELS.error;

export function setLogLevel(level: Level) {
  currentLevel = LEVELS[level] ?? LEVELS.error;
}

export function debug(...args: any[]) {
  if (currentLevel <= LEVELS.debug) console.debug("[DEBUG]", ...args);
}

export function info(...args: any[]) {
  if (currentLevel <= LEVELS.info) console.info("[INFO]", ...args);
}

export function warn(...args: any[]) {
  if (currentLevel <= LEVELS.warn) console.warn("[WARN]", ...args);
}

export function error(...args: any[]) {
  // Always log errors to console.error
  console.error("[ERROR]", ...args);
}

// Enable info in development by default
if (typeof __DEV__ !== "undefined" && __DEV__) setLogLevel("info");

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Securely exclude non-frontend heavy directories from the Metro file watcher and resolver.
// Uses root-specific path matching so it only excludes folders at the root level of the AuraMusic project.
const rootExclusionPattern = /[\\\/]AuraMusic[\\\/](android|\.expo|\.gemini|\.claude|dist|backend[\\\/](venv|\.venv|env))([\\\/]|$)/i;

if (!config.resolver) {
  config.resolver = {};
}

// Wrap the default blocklist/blacklist to ensure we preserve Expo's pre-configured exclusion rules
const defaultBlocklist = config.resolver.blocklist || config.resolver.blacklistRE;

config.resolver.blocklist = (path) => {
  // 1. Check if the path belongs to our root-level ignored directories
  if (rootExclusionPattern.test(path)) {
    return true;
  }
  // 2. Delegate to Metro/Expo's default blocklist rules
  if (typeof defaultBlocklist === 'function') {
    return defaultBlocklist(path);
  } else if (defaultBlocklist instanceof RegExp) {
    return defaultBlocklist.test(path);
  }
  return false;
};

module.exports = config;

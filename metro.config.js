const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const path = require('path');

// Securely exclude non-frontend heavy directories from the Metro file watcher and resolver at project root only.
// Must be RegExp without flags to match Metro's internal pattern combiner.
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rootExclusionRegex = new RegExp(
  `^${escapeRegExp(__dirname)}[\\\\/](${['android', 'ios', '\\.expo', '\\.gemini', '\\.claude', 'dist', 'backend'].join('|')})([\\\\/]|$)`
);

if (!config.resolver) {
  config.resolver = {};
}

const defaultBlockList = config.resolver.blockList || config.resolver.blacklistRE;

let combinedBlockList;
if (Array.isArray(defaultBlockList)) {
  combinedBlockList = [...defaultBlockList, rootExclusionRegex];
} else if (defaultBlockList instanceof RegExp) {
  combinedBlockList = new RegExp(`(?:${defaultBlockList.source})|(?:${rootExclusionRegex.source})`);
} else {
  combinedBlockList = rootExclusionRegex;
}

config.resolver.blockList = combinedBlockList;
config.resolver.blacklistRE = combinedBlockList;

module.exports = config;

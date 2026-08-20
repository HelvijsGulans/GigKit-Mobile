const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Keep Firebase Auth resolvable for the optional cloud-sync module.
config.resolver.extraNodeModules = {
  "firebase/auth": "firebase/auth",
};

// Allow .cjs for modern Firebase SDKs.
if (!config.resolver.sourceExts.includes("cjs")) {
  config.resolver.sourceExts.push("cjs");
}

// Ensure PNG extensions are included.
if (!config.resolver.assetExts.includes("png")) {
  config.resolver.assetExts.push("png");
}
if (!config.resolver.assetExts.includes("PNG")) {
  config.resolver.assetExts.push("PNG");
}

module.exports = config;

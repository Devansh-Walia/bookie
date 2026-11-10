// Signs release builds with a real keystore instead of the public debug key.
//
// Reads (env var first, then gradle property / ~/.gradle/gradle.properties):
//   BOOKIE_KEYSTORE_PATH      absolute path to the .keystore file
//   BOOKIE_KEYSTORE_PASSWORD  store password
//   BOOKIE_KEY_ALIAS          key alias
//   BOOKIE_KEY_PASSWORD       key password
//
// If BOOKIE_KEYSTORE_PATH is unset, release builds fall back to the debug key
// (with a warning) so local `assembleRelease` keeps working.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// @bookie/release-signing";

const RELEASE_SIGNING_CONFIG = `
        ${MARKER}
        release {
            def bookieProp = { String name -> System.getenv(name) ?: findProperty(name) }
            def ksPath = bookieProp("BOOKIE_KEYSTORE_PATH")
            if (ksPath) {
                storeFile file(ksPath)
                storePassword bookieProp("BOOKIE_KEYSTORE_PASSWORD")
                keyAlias bookieProp("BOOKIE_KEY_ALIAS")
                keyPassword bookieProp("BOOKIE_KEY_PASSWORD")
            }
        }`;

const RELEASE_SIGNING_SELECTOR = `if (signingConfigs.release.storeFile) {
                signingConfig signingConfigs.release
            } else {
                logger.warn("BOOKIE_KEYSTORE_PATH not set: signing release with the DEBUG key.")
                signingConfig signingConfigs.debug
            }`;

function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  // 1. Add a `release` entry to signingConfigs { ... } (after the debug entry).
  const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
  if (!debugConfig.test(gradle)) {
    throw new Error("withReleaseSigning: signingConfigs.debug block not found in app/build.gradle");
  }
  gradle = gradle.replace(debugConfig, `$1${RELEASE_SIGNING_CONFIG}`);

  // 2. Point buildTypes.release at it.
  const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseBuildType.test(gradle)) {
    throw new Error("withReleaseSigning: buildTypes.release signingConfig not found in app/build.gradle");
  }
  return gradle.replace(releaseBuildType, `$1${RELEASE_SIGNING_SELECTOR}`);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning: only Groovy build.gradle is supported");
    }
    cfg.modResults.contents = applyReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;

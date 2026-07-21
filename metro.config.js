// Learn more https://docs.expo.dev/guides/monorepos/#modify-the-metro-config
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Treat `.txt` files as binary/text assets (returned as a `require()`-able
// module with a `uri`) instead of trying to parse them as JS source.
// Used to bundle the vendored PDF.js UMD builds (see assets/pdfjs) so they
// can be read as raw text and inlined into the PDF viewer's WebView HTML.
config.resolver.assetExts.push("txt");

module.exports = config;

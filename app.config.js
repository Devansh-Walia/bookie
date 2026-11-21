// Dynamic config layered on top of app.json.
//
// `experiments.baseUrl` is a *web-only* setting: it tells the exported web app
// where it is mounted (GitHub Pages serves it at /bookie/app/). Metro also
// applies it to the native asset destinations, though, so an iOS build tries to
// write its assets to `Bookie.app/bookie/app/assets/...` and the "Bundle React
// Native code and images" phase dies with
//   ENOTDIR: not a directory, mkdir '.../Bookie.app/bookie/app/assets/...'
//
// So keep it out of app.json and set it only when we really are exporting for
// the web:
//   BOOKIE_BASE_URL=/bookie/app npx expo export -p web
//
// Native builds (prebuild, run:android/ios, export:embed) see no baseUrl.
const baseUrl = process.env.BOOKIE_BASE_URL;

module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(baseUrl ? { baseUrl } : {}),
  },
});

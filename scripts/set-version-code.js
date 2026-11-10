#!/usr/bin/env node
// Stamps app.json with a versionCode that always moves forward.
//
// Android refuses to install an APK whose versionCode is lower than (or, for
// Play, equal to) the installed one, so every build needs a bigger number.
// Commit count is monotonic across tags and branches, which is exactly what we
// want: no release can ever be a downgrade of an earlier one.
//
// Usage:
//   node scripts/set-version-code.js --tag v1.2.3   # version=1.2.3, code from git
//   node scripts/set-version-code.js --from-git     # code from git only
//   node scripts/set-version-code.js --code 42      # explicit code
//
// Writes app.json and package.json in place.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const appJsonPath = path.join(root, "app.json");
const pkgJsonPath = path.join(root, "package.json");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? null;
};

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
appJson.expo.android = appJson.expo.android || {};

// --- version string -------------------------------------------------------
const tag = flag("--tag");
let version = null;
if (tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  if (!m) {
    console.error(`set-version-code: cannot parse tag "${tag}" (expected v1.2.3)`);
    process.exit(1);
  }
  version = `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}`;
}

// --- versionCode ----------------------------------------------------------
const explicit = flag("--code");
let versionCode;

if (explicit !== null) {
  versionCode = Number(explicit);
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    console.error(`set-version-code: --code must be a positive integer, got "${explicit}"`);
    process.exit(1);
  }
} else {
  let commits = 0;
  try {
    commits = Number(
      execFileSync("git", ["rev-list", "--count", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    // No git (e.g. a tarball checkout): fall back to bumping what is there.
  }
  const current = Number(appJson.expo.android.versionCode) || 0;
  // Commit count is the source of truth. Only bump past it when there is no git
  // (tarball checkout), and never go backwards if history was rewritten.
  versionCode = commits > 0 ? Math.max(commits, current) : current + 1;
}

if (versionCode === Number(appJson.expo.android.versionCode) && !version) {
  console.log(`versionCode already ${versionCode}, nothing to do`);
  process.exit(0);
}

// --- write ----------------------------------------------------------------
appJson.expo.android.versionCode = versionCode;
if (version) {
  appJson.expo.version = version;
  pkgJson.version = version;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
}
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

console.log(
  `versionCode=${versionCode}${version ? ` version=${version}` : ` version=${appJson.expo.version}`}`,
);

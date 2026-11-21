#!/usr/bin/env node
// Stamps app.json with a versionCode (Android) and buildNumber (iOS) that
// always move forward.
//
// Android refuses to install an APK whose versionCode is lower than (or, for
// Play, equal to) the installed one, so every build needs a bigger number.
// iOS has the same rule for CFBundleVersion: a build whose build number is not
// greater than the installed one will not update it in place. Commit count is
// monotonic across tags and branches, which is exactly what we want: no release
// can ever be a downgrade of an earlier one.
//
// Both platforms share the number, so an Android APK and an iOS IPA built from
// the same commit are the same release.
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

function isShallow() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}
appJson.expo.android = appJson.expo.android || {};
appJson.expo.ios = appJson.expo.ios || {};

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

  // A shallow clone (actions/checkout defaults to depth 1) counts 1 commit, so
  // the number below would silently not move forward and the build would refuse
  // to install over the previous one. Fail loudly instead.
  if (commits > 0 && isShallow()) {
    console.error(
      "set-version-code: shallow git clone, so the commit count is meaningless.\n" +
        "Set `fetch-depth: 0` on actions/checkout, or pass --code explicitly.",
    );
    process.exit(1);
  }
  const current = Number(appJson.expo.android.versionCode) || 0;
  // Commit count is the source of truth. Only bump past it when there is no git
  // (tarball checkout), and never go backwards if history was rewritten.
  versionCode = commits > 0 ? Math.max(commits, current) : current + 1;
}

// --- buildNumber (iOS) ----------------------------------------------------
// Same number as versionCode: one monotonic counter for both stores.
const buildNumber = String(versionCode);

if (
  versionCode === Number(appJson.expo.android.versionCode) &&
  buildNumber === appJson.expo.ios.buildNumber &&
  !version
) {
  console.log(`versionCode already ${versionCode}, nothing to do`);
  process.exit(0);
}

// --- write ----------------------------------------------------------------
appJson.expo.android.versionCode = versionCode;
appJson.expo.ios.buildNumber = buildNumber;
if (version) {
  appJson.expo.version = version;
  pkgJson.version = version;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
}
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

console.log(
  `versionCode=${versionCode} buildNumber=${buildNumber}${version ? ` version=${version}` : ` version=${appJson.expo.version}`}`,
);

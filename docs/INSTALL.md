# Installing Bookie

Bookie is distributed as a signed APK on [GitHub Releases](https://github.com/Devansh-Walia/bookie/releases/latest).
It is **not** on the Play Store, and it does not need to be — Google Play policy only
applies to apps distributed *through* Play. An APK you download yourself is fine.

The catch is that Android treats every sideloaded app as suspicious, so the first
install needs a few taps. Here is what each screen means.

## Android

### 1. Allow your browser to install apps

When you tap the `.apk` download, Android may say *"For your security, your phone
is not allowed to install unknown apps from this source."*

- Tap **Settings** on that prompt (or go to Settings → Apps → Special access →
  Install unknown apps).
- Pick the app you downloaded with (Chrome, Firefox, Files…) and enable
  **Allow from this source**.

### 2. Get past Play Protect

Play Protect scans every sideloaded APK and shows one of these. Neither is a real
block — they are warnings because the developer is not verified by Google:

- *"Unsafe app blocked"* → tap **More details** → **Install anyway**.
- *"App scan recommended"* / *"Send app for scanning?"* → tap **Install anyway**
  (or **Don't send**).

If Play Protect refuses to offer "Install anyway", open the Play Store → profile
icon → Play Protect → ⚙️ → temporarily turn off **Scan apps with Play Protect**,
install, then turn it back on.

### 3. Uninstall any older Bookie first

If you have ever installed a build from Android Studio or `expo run:android`, that
copy is signed with the **debug key**. The release APK is signed with a different
key, and Android will refuse to install over it with *"App not installed"* or
*"package conflicts with an existing package"*.

Uninstall Bookie, then install the release APK. You only have to do this once.

### 4. OEM-specific blockers

Some manufacturers block sideloading at the OS level. Turn these off first:

| Device | Setting |
| --- | --- |
| Samsung (One UI 6.1+) | Settings → Security and privacy → **Auto Blocker** → off |
| Xiaomi / Redmi (MIUI, HyperOS) | Settings → Privacy protection → Special permissions → **Install unknown apps**; also disable *"MIUI optimization"* in Developer options |
| Oppo / Realme (ColorOS) | Settings → Password & security → System security → **Install external sources** |
| Vivo / iQOO (Funtouch) | Settings → More settings → **Install unknown apps** |
| OnePlus (OxygenOS) | Settings → Security → **Install unknown apps** |

### 5. Grant the App Lock permissions

App Lock is the only feature that needs anything beyond a normal install. Both
permissions are granted from Settings, **after** the app is installed — they are
never requested during install, and they are not what Play Protect warns about.

- **Usage access** — lets Bookie see which app is in the foreground.
  Settings → Apps → Special access → Usage access → Bookie → Allow.
- **Display over other apps** — lets Bookie draw the block screen.
  Settings → Apps → Special access → Display over other apps → Bookie → Allow.

Bookie opens both screens for you from **Settings → App Lock**.

> On Android 13+ some permissions are hidden behind **"Allow restricted settings"**
> for sideloaded apps. That applies to Accessibility, Notification access and
> All-files access — Bookie uses none of them, so you should not hit it. If a
> toggle is greyed out anyway: Settings → Apps → Bookie → ⋮ → **Allow restricted
> settings**.

### Updating

Download the new APK and install it over the old one. Your library, progress and
stats are kept — **but only if the signing key matches**.

Android identifies an app by `package name + signing certificate`. If the
certificate changes, the update is rejected with *"App not installed"*, and the
only way forward is to uninstall, which deletes `AsyncStorage` and
`Documents/books/`.

Bookie has shipped with two different keys:

| Build | Signed with | Certificate SHA-256 |
| --- | --- | --- |
| v1.1.0 (GitHub release) | `android/app/debug.keystore` (Expo's public debug key) | `FA:C6:17:45:…:03:3B:9C` |
| v1.2.0+ with `signing: release` | your `BOOKIE_KEYSTORE_BASE64` secret | yours |

So if you have v1.1.0 installed and want to keep your reading data, build the
update with the **`signing: debug`** workflow input. That signs with the same
public debug key, so it installs as a normal update.

To check what is installed on a device:

```bash
adb shell dumpsys package com.decker.bookie | grep -i signatures -A2
```

And to check a downloaded APK:

```bash
apksigner verify --print-certs Bookie-v1.2.0.apk
```

The two SHA-256 digests must be identical for an in-place update.

> **Moving to a real release key later** is a one-way door: it requires one
> uninstall, so export anything you care about first. Bookie has no export
> feature yet — if you plan to switch, add one before you do.

**Do not lose the signing keystore.** If it changes, Android treats the new APK as
a different app and you have to uninstall (losing all local data) to update.

## iOS

The `.ipa` on the releases page is **unsigned**. It cannot be installed by tapping
it — iOS requires a signature. Options:

- **AltStore** or **Sideloadly** (free, re-signs with your Apple ID, needs a
  re-sign every 7 days).
- **Xcode** — drag the `.ipa` onto a connected device with a free developer team.
- Build from source with `npm run ios`.

## Web

Nothing to install: <https://devansh-walia.github.io/bookie/> runs the app in the
browser. Note that App Lock is Android-only.

## Why not the Play Store?

Publishing would require a **Permissions Declaration Form** for
`PACKAGE_USAGE_STATS` and a **foreground-service declaration** for
`FOREGROUND_SERVICE_SPECIAL_USE`, both reviewed by hand. That is real overhead for
a personal project, and it buys nothing: the APK works the same either way.

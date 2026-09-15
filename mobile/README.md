# DronaSphere — Android app shell

A thin native wrapper around the real deployed web app, built with
[Capacitor](https://capacitorjs.com). There is no separate mobile codebase to
maintain: the `android/` project's WebView points straight at wherever
`web/` is actually running (`capacitor.config.ts` → `server.url`), the same
way a browser would. When the web app changes, this app changes with it —
nothing to rebuild except when the *address* of the deployment changes, or
when you want a new icon/splash/app-store listing.

This is deliberate, not a shortcut: the product is real-time (websockets,
live chat, auth-gated everything). Bundling a static snapshot into the APK
would mean shipping a copy that's stale the moment you build it.

**Honest limitation:** this project was scaffolded and configured in a
sandbox with no Android SDK installed, so nothing here has actually been
compiled yet. `npx cap add android` ran successfully and the generated
project looks structurally correct (verified by hand — see "What's already
done" below — including one real bug in Capacitor's own default template
that's already fixed here), but the very first `./gradlew assembleDebug` you
run is also the first real build this project has ever gone through. Don't
skip it before distributing an APK to anyone.

## Why iOS isn't here

Apple doesn't allow installing an app outside the App Store / TestFlight
without an Apple Developer account and either a review or a device UDID
registration — there's no equivalent of "hand someone an APK." Rather than
half-support that, iOS gets a proper installable PWA instead (see
`web/app/manifest.ts`, `web/app/apple-icon.tsx`, `web/app/sw.js/route.ts`):
"Add to Home Screen" from Safari gives a standalone, full-screen, icon-on-
the-home-screen app with no App Store step at all. If you do want a real
iOS app later, this same Capacitor project supports `npx cap add ios` —
it just needs a Mac with Xcode, which this sandbox doesn't have either.

## What's already done

- `capacitor.config.ts` — app id `com.dronasphere.app`, points at
  `CAPACITOR_SERVER_URL` (env var, baked in at `cap sync` time — see below).
- Real launcher icons at every density (`mipmap-*/ic_launcher*.png`) and a
  proper adaptive-icon foreground/background pair, generated from the same
  mark as `web/app/icon.svg` — not the default Capacitor placeholder.
- A splash screen (`drawable*/splash.png`, every density/orientation)
  matching the app's dark theme — not the default blue Capacitor logo.
- **Fixed a bug in Capacitor's own template**: `values/styles.xml`
  references `@color/colorPrimary`, `colorPrimaryDark`, `colorAccent`, but
  the generated project shipped no `values/colors.xml` defining them — that
  would have failed the very first Gradle build with a missing-resource
  error. Added `values/colors.xml` with the web app's own plum palette.
- `AndroidManifest.xml` already has the `INTERNET` permission (Capacitor
  adds this by default) and cleartext HTTP is enabled *only* if
  `CAPACITOR_SERVER_URL` is `http://`, not `https://` — see the config file.

## Building it for real

You need [Android Studio](https://developer.android.com/studio) (it bundles
the JDK and lets you install SDK platforms/build-tools through its own UI —
by far the least error-prone path) or, for the CLI-only route, the Android
SDK command-line tools plus a JDK 17+ on `PATH`.

```bash
# From this directory (mobile/):

# 1. Point it at your actual deployment before syncing — this value gets
#    written into the native project, it is not read at runtime.
export CAPACITOR_SERVER_URL=http://<your-homelab-address>:8099   # or your real domain, https://...

# 2. Re-sync (only needed after changing capacitor.config.ts, adding a
#    Capacitor plugin, or editing www/ — cap add already did this once)
npx cap sync android

# 3a. Open in Android Studio (recommended for a first build — it will
#     prompt to install any missing SDK platform/build-tools automatically)
npx cap open android

# 3b. ...or build a debug APK from the CLI once the SDK is set up
#     (needs ANDROID_HOME/ANDROID_SDK_ROOT set)
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

A debug APK installs directly on any Android device or emulator with
`adb install app-debug.apk` — no Play Store, no signing required, no
developer account. That's the actual "Android app you can hand someone"
deliverable this whole approach was for.

### Release builds (signed, for real distribution)

A release build needs a signing key. Generate one once and keep it safe —
losing it means you can never update the app under the same identity again:

```bash
keytool -genkey -v -keystore dronasphere-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias dronasphere
```

Then configure signing in `android/app/build.gradle` (a `signingConfigs` +
`buildTypes.release.signingConfig` block referencing the keystore) before
running `./gradlew bundleRelease` (for the Play Store, an `.aab`) or
`./gradlew assembleRelease` (a directly-installable signed `.apk`). This
repo does **not** include a keystore or signing config — that's a secret
only you should hold, never committed.

## If the deployment address changes

Re-run step 1 and 2 above (`CAPACITOR_SERVER_URL=... npx cap sync android`)
and rebuild. The address is baked into the APK at build time, not fetched at
runtime — the same tradeoff `web/Dockerfile`'s `NEXT_PUBLIC_API_BASE_URL`
already makes, for the same reason (a WebView can't ask the internet "where
do I even point myself" before it has anywhere to point itself at).

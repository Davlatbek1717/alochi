# A'lojon Kiosk (Android)

A locked-down, single-purpose Android launcher that boots straight into
the A'lojon web app (`https://alojon.uz`) and **cannot be left**. This is
the real device lockdown referenced by the in-app `SessionGuard` — the
web app enforces the study-time policy; this APK enforces that the tablet
can run *nothing but* A'lojon.

## What it does

- Full-screen, immersive WebView of `https://alojon.uz` (no browser
  chrome, no URL bar).
- Becomes the device **HOME / launcher** app — pressing Home does
  nothing but return to A'lojon.
- Uses Android **Lock Task mode** (kiosk) when the app is set as
  **device owner** — recents, status bar, notifications, and other apps
  are blocked by the OS, not just hidden.
- Relaunches itself on boot and if killed.
- Navigation is pinned to the `alojon.uz` domain; off-domain links are
  refused (no escaping to a browser).

## ⚠️ Build note (honest)

This is a **source scaffold**. It is NOT pre-compiled — building the
`.apk`/`.aab` requires Android Studio (Giraffe+) or a Gradle + Android
SDK toolchain, which is not available in the dev sandbox this was
generated in. To build:

```bash
cd apps/kiosk-android
# Generate the Gradle wrapper jar once (needs a local Gradle ≥ 8.2):
gradle wrapper --gradle-version 8.7
./gradlew :app:assembleRelease    # → app/build/outputs/apk/release/
```

Or just open `apps/kiosk-android/` in Android Studio and Run.

Signing for production: create a keystore and set
`KIOSK_STORE_FILE / KIOSK_STORE_PASSWORD / KIOSK_KEY_ALIAS /
KIOSK_KEY_PASSWORD` env vars (wired in `app/build.gradle`).

## Provisioning

See [PROVISIONING.md](./PROVISIONING.md) for the three supported ways to
make this app **device owner** (the privilege that unlocks true kiosk
mode): adb (dev/single device), QR zero-touch (bulk), and EMM.

## Config

The target URL lives in `app/src/main/res/values/strings.xml`
(`kiosk_url`). Change it once and rebuild for a different tenant/domain.

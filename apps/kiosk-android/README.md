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

## ✅ Get the APK — no local setup (recommended)

The repo ships a CI pipeline that builds the APK for you. You do **not**
need Android Studio or any Android SDK on your machine.

1. Push this code to GitHub (already the `origin` remote).
2. GitHub → **Actions** tab → **"Build A'lojon Kiosk APK"** →
   **Run workflow**.  *(or* `git tag kiosk-v1.0.0 && git push origin
   kiosk-v1.0.0` *to also cut a Release.)*
3. When it finishes (~3–5 min), open the run → **Artifacts** →
   download **`alojon-kiosk-apk`** → inside is
   `alojon-kiosk-debug.apk`.
4. That `.apk` is the file you give to others / sideload onto the
   tablets. It installs and runs immediately.
   Then **provision each tablet as device owner** — this is mandatory
   for true kiosk lock; see [PROVISIONING.md](./PROVISIONING.md).

### Production (stable) signing — do this before a real fleet rollout

A debug APK works, but updates only install over an APK signed with the
**same key**. For a fleet, create one keystore once and add it as repo
secrets so CI emits `alojon-kiosk-release.apk`:

```bash
keytool -genkeypair -v -keystore kiosk.keystore -alias kiosk \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 kiosk.keystore        # copy this string
```

GitHub → repo **Settings → Secrets and variables → Actions** → add:
`KIOSK_KEYSTORE_BASE64` (the base64 above), `KIOSK_STORE_PASSWORD`,
`KIOSK_KEY_ALIAS` (`kiosk`), `KIOSK_KEY_PASSWORD`. Re-run the workflow.
**Keep `kiosk.keystore` safe — losing it means you can't ship updates.**

## Local build (only if you prefer Android Studio)

Open `apps/kiosk-android/` in Android Studio (Giraffe+) and Run, or:

```bash
cd apps/kiosk-android
gradle wrapper --gradle-version 8.7   # one-time, needs local Gradle ≥ 8.5
./gradlew :app:assembleDebug          # → app/build/outputs/apk/debug/
```

## Provisioning

See [PROVISIONING.md](./PROVISIONING.md) for the three supported ways to
make this app **device owner** (the privilege that unlocks true kiosk
mode): adb (dev/single device), QR zero-touch (bulk), and EMM.

## Config

The target URL lives in `app/src/main/res/values/strings.xml`
(`kiosk_url`). Change it once and rebuild for a different tenant/domain.

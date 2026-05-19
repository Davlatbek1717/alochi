# Provisioning the A'lojon Kiosk (device owner)

True, unbypassable kiosk mode requires the app to be **device owner**.
A device owner can only be set on a **freshly factory-reset device with
no accounts added** (Android security rule — you cannot promote an app
to device owner on an already-used device).

The app itself needs **no manual kiosk steps** after this: on launch it
detects device-owner status, allowlists itself for Lock Task, disables
the keyguard/status bar, registers as HOME, and enters kiosk mode
(`MainActivity.enforceKioskPolicies()`).

---

## Method 1 — adb (single device / dev / small batches)

1. **Factory reset** the tablet. In the setup wizard **do not add any
   Google or other account**, skip everything, finish to the home
   screen. Enable Developer Options → USB debugging.
2. Install the APK:
   ```bash
   adb install -r app/build/outputs/apk/release/app-release.apk
   ```
3. Promote to device owner:
   ```bash
   adb shell dpm set-device-owner uz.alojon.kiosk/.KioskDeviceAdminReceiver
   ```
   Expected: `Success: Device owner set to package uz.alojon.kiosk`.
   *If it says an account exists* → a Google/other account is on the
   device; factory reset and retry without adding one.
4. Reboot. The tablet now boots straight into A'lojon and cannot leave.

## Method 2 — QR-code provisioning (recommended for bulk rollout)

1. Host the signed APK somewhere the tablets can reach over Wi-Fi
   (e.g. `https://alojon.uz/kiosk/app-release.apk`).
2. Compute the APK's SHA-256 and base64url-encode it:
   ```bash
   openssl dgst -sha256 -binary app-release.apk | openssl base64 | tr '+/' '-_' | tr -d '='
   ```
3. Build the provisioning QR JSON:
   ```json
   {
     "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
       "uz.alojon.kiosk/.KioskDeviceAdminReceiver",
     "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
       "https://alojon.uz/kiosk/app-release.apk",
     "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
       "<base64url-sha256-from-step-2>",
     "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
     "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true
   }
   ```
   Encode that JSON as a QR code.
4. On a **factory-reset** device, at the very first "Hi there" setup
   screen, **tap the screen 6 times** to open the QR scanner, connect
   Wi-Fi, scan the QR. The device downloads the APK, sets it as device
   owner, and boots into the kiosk automatically.

## Method 3 — EMM / Android zero-touch

Upload the APK to your EMM (or zero-touch portal), set the device-admin
component to `uz.alojon.kiosk/.KioskDeviceAdminReceiver`, push a "kiosk /
COSU" policy. Devices purchased through a zero-touch reseller enroll on
first boot with no manual step.

---

## What device-owner unlocks (already wired in code)

| Capability | API used |
|---|---|
| Lock Task allowlist (kiosk) | `setLockTaskPackages` + `startLockTask` |
| Stay on top after Home press | `addPersistentPreferredActivity` (HOME) |
| No lock screen interruptions | `setKeyguardDisabled(true)` |
| No status bar / quick settings | `setStatusBarDisabled(true)` |
| Survive reboot | `BootReceiver` + HOME role |

Without device owner the app still runs and the **app-level** fencing
holds (immersive, domain-locked WebView, Home/Back swallowed), but the
OS-level guarantees (recents, status bar, other apps) are **not**
enforced — so always provision as device owner for production tablets.

## Maintenance / removing the kiosk

Device-owner status **cannot** be removed with `adb shell dpm
remove-active-admin` (that is blocked for device owners). To service a
device:

- **Factory reset** (Settings are blocked in kiosk, so reset via
  recovery: power + volume, or `adb reboot recovery`), **or**
- temporarily run a debug build:
  ```bash
  adb shell dpm set-device-owner ... # only on a clean device
  ```
- A future hidden maintenance gesture (e.g. 10-tap on a corner →
  PIN → `DevicePolicyManager.clearDeviceOwnerApp`) is **not** in v1;
  add it before fleet rollout if on-site un-provisioning is needed.

## Updating the app on provisioned devices

`adb install -r app-release.apk` works while device owner (same
signing key required). For fleets, push the new APK via EMM or have the
kiosk poll a version endpoint and prompt a re-install during a
maintenance window.

# Getting this onto a phone

## What cannot be done in this repo's CI sandbox

Stated first, because it is the question everyone asks:

- **iOS Simulator does not run on Linux.** It ships only with Xcode, and Xcode
  is macOS-only. This is architectural, not a missing package.
- **The Android emulator needs hardware virtualisation.** This build environment
  reports no `vmx`/`svm` CPU flags and has no `/dev/kvm`, so an emulator would
  fall back to full software translation — technically alive, practically
  unusable — and the SDK download host is blocked here anyway.

So nothing in this repo has ever been seen running on a real or simulated
phone. What *has* been verified is that the components render and behave
correctly under `react-native-web` (`npm run screenshot`), that everything
typechecks under the same strict settings as the rest of the workspace, and
that all the pure logic is unit-tested.

## Building iOS without owning a Mac

This is the part worth knowing: **EAS builds on macOS machines in the cloud.**
You do not need Apple hardware, only an Apple Developer account for signing.

```bash
npm i -g eas-cli
eas login
eas init                      # replaces the placeholder projectId in app.json

# A development build — this is what you need, because the app uses native
# modules and therefore cannot run in Expo Go.
eas build --profile development --platform ios
eas build --profile development --platform android

# Internal testers
eas build --profile preview --platform all

# Store submission
eas build --profile production --platform all
eas submit --platform all
```

`eas.json` defines those three profiles. `development` produces a simulator
build for iOS and an APK for Android; `production` produces an app bundle.

## Why Expo Go will not work

Two native modules are declared, and Expo Go ships a fixed set:

| Module | Needed for |
|---|---|
| `expo-camera` | Photographing a station sign for offline recovery |
| `expo-sensors` | Counting stops from motion when there is no signal |

Running `npx expo start` and scanning a QR code will fail once those are wired
into a screen. Use `eas build --profile development` once, install the
resulting build, and then `npx expo start --dev-client` for day-to-day work.

## Permissions, and the strings users actually read

Declared in `app.json`. Apple rejects vague purpose strings, and more
importantly a person deciding whether to grant camera access to a subway app
deserves to know the photo is not being uploaded:

> Photograph a station sign and Streetlevel will work out where you are. The
> photo is read on this phone and never leaves it.

Android's list is deliberately short — `CAMERA`, `ACTIVITY_RECOGNITION`,
`HIGH_SAMPLING_RATE_SENSORS` — and `RECORD_AUDIO` plus
`ACCESS_BACKGROUND_LOCATION` are explicitly **blocked**, because a dependency
pulling either one in silently would be a genuine privacy regression in an app
that has no business with a microphone.

## Icons

Generated, not drawn:

```bash
node tools/icons/build.mjs
```

`tools/icons/mark.html` renders the mark — the stop ladder, with the
destination filled in MTA red — and Chromium screenshots it at each required
size. Keeping it as code means the icon cannot drift from the palette the
client ships, and the adaptive-icon variant is generated at the smaller scale
Android's mask requires rather than being cropped by hand.

## Before the first store submission

Not done, and each one is a real task:

- `eas init` to get a real `projectId` (currently a placeholder of zeroes).
- Apple Developer and Google Play accounts, and the signing credentials EAS
  will prompt for.
- A privacy policy URL. Both stores require one, and this app touches camera
  and motion, so the questionnaire answers need to match the strings above.
- Point `extra.apiBaseUrl` at a deployed server. It currently names a host that
  does not exist.

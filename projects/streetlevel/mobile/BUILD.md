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

## Seeing it run, with hot reload

**Claude Code Desktop has an iOS Simulator pane**, and it is the fastest way to
put this app in front of a person. The one thing to know is that it works in
**local sessions only** — a cloud or SSH session runs on a machine that cannot
reach the simulators on your Mac, so the session that opens this repo has to be
running on the Mac itself.

Requirements, from Anthropic's own docs: Claude Desktop v1.24012.0 or later,
macOS, and **Xcode 26.x** — the pane does not yet work with Xcode 27, which
replaced the Simulator app with Device Hub. If `xcode-select -p` points at 27,
install 26.x alongside it and select it:

```bash
sudo xcode-select -s /Applications/Xcode-26.4.app
```

Then, in a local session with this repo as the project folder:

```bash
npm install
npm run build                       # the workspace packages the app imports
npm start --workspace=streetlevel-mobile -- --ios
```

Fast Refresh works normally; Metro is running on your machine, so an edit to a
screen repaints the simulator without a rebuild.

**No prebuild is needed.** Every native dependency here is an `expo-*` module
that ships inside Expo Go, and there is no `ios/` directory to keep in sync.

### What has actually been verified

Not "it should work" — these were run:

- `npx expo export --platform ios` bundles the app: **672 modules, 1.4 MB** of
  Hermes bytecode.
- `npx expo export --platform android` bundles it too: **1.7 MB**.
- Metro resolves the `@streetlevel/*` workspace packages out of the monorepo,
  which is the thing most likely to break in a setup like this.

So the bundler path is proven. What is still unproven is everything that only
happens on a device: real font metrics, real haptics, `expo-sqlite` against a
real file, and `expo-camera` permissions.

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

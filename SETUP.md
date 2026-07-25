# AdvisoryDeck — build & deploy

Two delivery channels, one codebase:

| Channel | How it deploys |
|---|---|
| **Web app** (Railway) | Merge a PR into `main` → Railway builds and deploys automatically. Nothing to do. |
| **iOS app** (TestFlight) | The same merge also triggers GitHub Actions (`.github/workflows/deploy.yml`), which builds the native iOS shell, signs it, and uploads to TestFlight. |

The iOS app is the React frontend bundled into a native shell (Capacitor,
project in `frontend/ios/`), talking to the Railway backend. Nobody ever runs
Xcode by hand — CI does everything on a macOS runner.

## How deploys trigger

- **Push / merge to `main`** → `beta` lane: decrypts signing material via
  match, sets the build number to (latest TestFlight build + 1), builds a
  signed release, uploads to TestFlight.
- **Pull request** → `build_check` lane: compiles the app without signing.
  A red ❌ on the PR means the iOS build would break.
- **Manual run** (Actions → iOS → "Run workflow") → `build_check` plus a
  `preflight` job that verifies every secret end-to-end without touching
  anything: all five secrets present, the certificates-repo token can read
  and write, the App Store Connect key authenticates, and the app record
  exists. Run it after rotating any secret.

Builds use the newest Xcode 26 on the runner (a `Select Xcode 26` step in
the workflow) because Apple requires the iOS 26 SDK for App Store uploads.
When Apple raises the bar again, update that step's glob.

## Configuration (GitHub → repo Settings → Secrets and variables → Actions)

**Variables** (plain text — all three have working defaults committed in the
workflow, so setting them is only needed if a value ever changes):

| Name | Default |
|---|---|
| `APPLE_TEAM_ID` | `MY9X7AJBKT` |
| `RAILWAY_APP_URL` | `https://art-advisor-platform-production.up.railway.app` |
| `MATCH_GIT_URL` | `https://github.com/moonj-asmr/advisorydeck-certificates.git` |

**Secrets**:

| Name | Value |
|---|---|
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID of the App Store Connect API key |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID from the same page |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | full text of the downloaded `.p8` file |
| `MATCH_PASSWORD` | passphrase that encrypts the certificates repo |
| `MATCH_REPO_PAT` | fine-grained GitHub token with Contents read/write on `advisorydeck-certificates` only |

Secret values live **only** in GitHub's secrets store and your password
manager — never in this repo, never in chat.

## Bumping the marketing version

The build number is automatic. The human-visible version (1.0 → 1.1) lives in
`frontend/ios/App/App.xcodeproj/project.pbxproj` as `MARKETING_VERSION`.
Change both occurrences (or ask Claude to), merge, done.

## If signing breaks

Certificates/profiles live encrypted in the private `advisorydeck-certificates`
repo, managed by fastlane match. If Apple revokes or something expires:

1. Delete the contents of the certificates repo (or run
   `bundle exec fastlane match nuke distribution` from a machine with the env
   vars set).
2. Re-run the `beta` lane (push to `main` or re-run the workflow) — match
   recreates the certificate and profile automatically.

If you rotate the App Store Connect API key, update the three
`APP_STORE_CONNECT_*` secrets.

## One-time prerequisites (already done or done during setup)

- Apple Developer membership (paid, personal team).
- App record in App Store Connect: name **AdvisoryDeck**, bundle ID
  `com.advisorydeck.app`.
- Private repo `advisorydeck-certificates` (empty; match fills it).
- The variables and secrets above.

## Costs to know about

GitHub's macOS runners bill at 10× normal minutes. Measured real runs: a
TestFlight deploy takes ~2–3 runner minutes (≈20–30 billed minutes) and a PR
compile check ~1.5 minutes. The workflow also caps runaway jobs
(`timeout-minutes`: 15 for checks, 30 for deploys) so a hang can't burn the
budget. On a free private-repo plan (2,000 min/month) that's roughly 60+
deploys a month; this repo is public, where Actions minutes are free.

## Renewals to remember

- **MATCH_REPO_PAT** (fine-grained GitHub token): expires 1 year after
  creation — regenerate in GitHub → Settings → Developer settings, then
  update the secret and run a manual preflight.
- **Distribution certificate**: expires after 1 year. When it does, follow
  "If signing breaks" above — match recreates it in one run.

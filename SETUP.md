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

## Configuration (GitHub → repo Settings → Secrets and variables → Actions)

**Variables** (plain text):

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | 10-character team ID from developer.apple.com → Membership |
| `RAILWAY_APP_URL` | `https://…up.railway.app` — the backend the app talks to |
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

GitHub's macOS runners bill at 10× normal minutes. A typical iOS build run is
~10–15 runner minutes (≈100–150 billed minutes). On a free private-repo plan
(2,000 min/month) that supports roughly a dozen deploys a month — merging
several PRs at once into `main` batches them into one deploy. If it gets
tight: make the repo public, upgrade the plan, or restrict `build_check` to
PRs that touch `frontend/`.

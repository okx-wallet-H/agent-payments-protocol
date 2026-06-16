# HWallet Staging Server Deployment

This guide is for a temporary VPS or reused server that runs the HWallet backend
for real mobile testing. The server is only a staging API. It must not enable
live orders, swaps, or transaction broadcasting.

## What We Need From The Server

- Ubuntu 22.04+ or similar Linux.
- A public domain or subdomain pointing to the server, for example
  `api-staging.example.com`.
- HTTPS through Caddy, Nginx, or the provider load balancer.
- Node.js 22 or 24 and npm.
- Outbound network access to Supabase, Privy, X Layer RPC, and OKX data APIs.
- SSH access by key. Do not paste passwords or secrets into chat.

## Server Environment

Create the real env file on the server from:

```sh
deploy/staging.env.example
```

Recommended path on the server:

```sh
/etc/agent-wallet/staging.env
```

Keep these staging gates on:

```sh
NODE_ENV=production
HWALLET_SESSION_STORE=postgres
AGENT_REQUIRE_OWNER=true
AGENT_REQUIRE_PRIVY_TOKEN=true
```

Keep live execution closed:

```sh
AGENT_WALLET_REAL_EXECUTION=false
ONCHAINOS_LIVE_MODE=false
POLYMARKET_LIVE_MODE=false
POLYMARKET_TRADING_API_ENABLED=false
```

## First Deploy

Example server commands:

```sh
sudo useradd --system --create-home --shell /usr/sbin/nologin agentwallet
sudo mkdir -p /srv/agent-wallet /etc/agent-wallet
sudo chown -R agentwallet:agentwallet /srv/agent-wallet
sudo chmod 750 /etc/agent-wallet
```

Clone or copy the repository into `/srv/agent-wallet`, then install and build:

```sh
cd /srv/agent-wallet
npm ci
npm run db:migrate:postgres
npm run build
```

Install the systemd service using
`deploy/agent-wallet-staging.service.example` as a template:

```sh
sudo cp deploy/agent-wallet-staging.service.example /etc/systemd/system/agent-wallet-staging.service
sudo systemctl daemon-reload
sudo systemctl enable --now agent-wallet-staging
sudo systemctl status agent-wallet-staging --no-pager
```

The staging service binds to `127.0.0.1:3102` so it is not exposed directly on
the public IP. Point HTTPS to `127.0.0.1:3102`. If using Caddy, start from
`deploy/Caddyfile.example`.

## Required Verification

Run local config readiness:

```sh
npm run smoke:hwallet-release-candidate
npm run smoke:supabase-cutover-safety
npm run smoke:supabase-staging-sequence
npm run smoke:supabase-readback-drill
npm run smoke:supabase-rollback-plan
EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-readiness
```

Run remote server readiness:

```sh
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-server
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-storage-summary
STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-auth-surface
```

Then update `apps/mobile/eas.json` preview and production
`EXPO_PUBLIC_API_BASE_URL` values to the same HTTPS API URL and run:

```sh
EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env
```

Before calling the staging backend a release candidate, run the HWallet release
candidate gate from `docs/V2_RELEASE_CHECKLIST.md`. The authenticated device
smoke must use two short-lived Privy tokens so User A and User B receive
different HWallet addresses and cannot read each other's memory, audit, records,
or tx history.

For the final App handoff pass, run the staging handoff gate:

```sh
npm run smoke:hwallet-staging-handoff
HWALLET_STAGING_HANDOFF_STRICT=true HWALLET_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence.json MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=<short-lived-user-a-token> MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=<short-lived-user-b-token> npm run smoke:hwallet-staging-handoff
```

The strict mode is the release handoff: it requires staging auth/storage/server
checks, the device-facing API smoke, and redacted manual device evidence.

For a Supabase storage switch rehearsal, keep the staging server live execution
switches closed and run the local sequence from `docs/V2_RELEASE_CHECKLIST.md`:
`dual` shadow writes, dual consistency, `postgres` readback, and postgres
performance. Run the Supabase readback drill first so the documented sequence
and script coverage agree before the server points a build at Postgres. If the
same performance endpoint fails twice, keep staging in `dual` or `jsonl` mode
and do not publish an EAS Update from that backend.

Only after these pass should we build a development client or TestFlight build.

## What The Server Smoke Checks

- The server is reachable over HTTPS.
- HWallet storage is `postgres`.
- Supabase schema is ready and has no missing HWallet tables.
- Privy Bearer token auth is required.
- Owner guard is enabled.
- Protected HWallet APIs reject missing tokens.
- Real execution, Onchain OS live mode, prediction live trading, and public
  trading API execution are all closed.
- The Supabase rehearsal confirms wallet, transfer, message, audit, record, and
  memory readback before the App build points at the staging API.

# HWallet EAS Update Runbook

## What Can Use Hot Update

- UI layout, text, and React component changes.
- Agent preview flow copy and small interaction fixes.
- API client logic that does not require a new native module.
- Bundled image or font asset changes that remain compatible with the same native runtime.

## What Still Needs A New Build

- Adding or upgrading native modules such as Expo SDK packages.
- Changing bundle id, URL scheme, app permissions, entitlements, or native config.
- Changing Privy native extension setup.
- Any change that requires App Store / TestFlight binary review.

## Preview Update Flow

Use preview first for installable real HWallet / Privy device testing:

```bash
cd apps/mobile
npm run update:preview -- --message "Short update note"
```

The preview channel should not set `EXPO_PUBLIC_AGENT_WALLET_PREVIEW`. That flag is only for local visual-only demos through `npm run start:v2:preview`.

The installed preview build must already include `expo-updates` and subscribe to the `preview` channel. For real HWallet login testing, use native build number `7` or later.

## Production Update Flow

Only after preview is checked on device:

```bash
cd apps/mobile
npm run update:production -- --message "Short production update note"
```

Keep production updates limited to safe JS/UI fixes while live execution remains closed.

## Rollback / Inspection Flow

Before promoting an update, list the channel history and keep the last known
good update id in the release notes:

```bash
cd apps/mobile
npx eas-cli update:list --channel preview
npx eas-cli update:list --channel production
```

If a JS/UI update breaks HWallet login, copy feedback, keyboard behavior, or
multi-user switching, publish a new update that reverts the offending change on
the same channel. If the issue requires native config, Privy native extension
changes, permissions, bundle id, URL scheme, or a new Expo module, do not use
OTA as the fix path; create a new build.

## Validation Before Publishing

Run these before publishing an update:

```bash
npm run smoke:mobile-testflight-readiness
npm --prefix apps/mobile run typecheck
EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env
```

For larger changes, run:

```bash
npm run verify:merge
```

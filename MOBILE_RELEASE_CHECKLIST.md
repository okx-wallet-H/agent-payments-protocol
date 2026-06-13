# Mobile Release Checklist

## Current App
- Mobile app path: `apps/mobile`
- Framework: Expo / React Native
- Platforms: iOS and Android
- Backend: existing Next API in this repo
- API base URL: `EXPO_PUBLIC_API_BASE_URL`

## Local Run
1. Start backend:
   ```bash
   npm run dev
   ```
2. Start mobile:
   ```bash
   npm run mobile:dev
   ```
3. API URL defaults:
   - iOS simulator: `http://localhost:3000`
   - Android emulator: `http://10.0.2.2:3000`
   - Physical phone: use the computer LAN URL.

## Mobile Environment Gates
Run the local mobile config gate before handing the build to anyone else:

```bash
npm run smoke:mobile-build-env
```

For a physical phone on the same network, set the API URL to the computer's
LAN backend address and require the device-safe gate:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000 MOBILE_DEVICE_READINESS=true npm run smoke:mobile-build-env
```

After the device-safe config gate passes, run the HWallet live journey against
the same device API URL:

```bash
MOBILE_DEVICE_API_BASE_URL=http://YOUR_LAN_IP:3000 npm run smoke:mobile-device-hwallet:live
```

This checks the phone-reachable backend path for HWallet home binding, one
receive-address card, transaction-hash verification, wallet records, audit,
memory, user isolation, and the Agent follow-up route. It is intentionally not
part of `npm run verify:merge` because it requires a running backend reachable
from the phone network.

For TestFlight / internal Android testing, the API URL must be HTTPS and the
EAS project id plus Privy mobile client config must be present:

```bash
EXPO_PUBLIC_API_BASE_URL=https://YOUR_STAGING_API MOBILE_STAGING_READINESS=true npm run smoke:mobile-build-env
```

The smoke output intentionally prints only safe booleans/categories, never
raw Privy ids, tokens, app secrets, database URLs, or API keys.

## Before Store Submission
- Replace `com.agentwallet.xlayer` with the final legal bundle ID / package name.
- Replace `replace-with-eas-project-id` after running `eas init` in `apps/mobile`.
- Replace `https://api.example.com` in `apps/mobile/eas.json` with the production API URL.
- Add final app icon, adaptive icon foreground, screenshots, privacy policy URL, support URL.
- Connect Privy production app credentials and deploy the backend behind HTTPS.
- Replace file storage with production database and server auth before real funds.
- Polymarket public market reads are available through the installed plugin; keep live buy/sell disabled until typed confirmation and per-trade preview gates are implemented.

## Build Commands
```bash
npm run mobile:typecheck
npm run smoke:mobile-build-env
npm run mobile:build:ios
npm run mobile:build:android
```

## Submit Commands
```bash
npm --prefix apps/mobile run submit:ios
npm --prefix apps/mobile run submit:android
```

The mobile build scripts use `npx eas ...`, so EAS CLI is intentionally not installed as a project dependency.

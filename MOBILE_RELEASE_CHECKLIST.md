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
npm run mobile:build:ios
npm run mobile:build:android
```

## Submit Commands
```bash
npm --prefix apps/mobile run submit:ios
npm --prefix apps/mobile run submit:android
```

The mobile build scripts use `npx eas ...`, so EAS CLI is intentionally not installed as a project dependency.

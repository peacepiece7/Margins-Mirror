# Margins Mobile

The iOS and Android client for Margins, built with Expo SDK 57 and React Native 0.86.

## Local development

Use Node 22.14 from `.nvmrc`, then:

```bash
npm ci
npm run ios
```

The default backend origins are `http://localhost:5813` on iOS and `http://10.0.2.2:5813` on an
Android emulator. Override them with `EXPO_PUBLIC_API_BASE_URL` only when the app must reach another
public origin. `EXPO_PUBLIC_*` values are bundled and must never contain secrets.

Native Google OAuth uses `margins://oauth/google` only in development. Preview and production
builds must set `EXPO_PUBLIC_OAUTH_REDIRECT_URI` to the verified HTTPS app link configured in the
iOS associated domains, Android intent filters, backend
`MARGINS_GOOGLE_OAUTH_MOBILE_REDIRECT_URIS`, and provider console. If it is absent, local credential
login remains available and the Google action fails closed as not configured.

Release email verification uses a hosted Turnstile bridge. Set
`EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URI` to the same verified HTTPS app link as backend
`MARGINS_NATIVE_TURNSTILE_BRIDGE_RETURN_URI`. The backend bridge also requires abuse protection,
mail delivery, its public site key and HTTPS hosted origin. The browser return carries no email,
challenge token or native proof; the app redeems the completed bridge with its in-memory one-time
proof. Development builds continue to use the backend's local verification-code path.

Local native builds require Xcode 26 with Swift 6.2 or newer on macOS, and the current Android SDK,
emulator and JDK on Android hosts. `eas.json` contains development-client and internal preview build
profiles for credentialed EAS builds.

## Quality

```bash
npm run quality
```

The quality command runs strict TypeScript, Expo ESLint and the dependency-direction audit, Jest,
Expo Doctor, Android/iOS JavaScript export and the export-artifact secret scan.

Product and architecture contracts live in `../DESIGN.md` and
`../docs/architecture/mobile-application/`.

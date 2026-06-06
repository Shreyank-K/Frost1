# Frost Launch-Ready

This build is configured for the Supabase-hosted Frost backend by default.

## What changed
- Expo upgraded to SDK 54-compatible dependencies
- Removed the `expo-sqlite` plugin to avoid native plugin/runtime issues
- Local persistence simplified to AsyncStorage only
- Auth now uses the shared `utils/db.js` layer instead of writing directly to AsyncStorage
- Existing auth data is migrated automatically from the old `frost_user` key on first launch
- Supabase Auth, Postgres, and Edge Functions are the default backend
- Local backend kept separate and optional for development

## Run the app
```bash
npm install
npx expo start -c
```

## Backend

The app defaults to:

```text
https://eqiakgiwjubsnrgsylxc.supabase.co/functions/v1
```

You normally do not need to run a local backend. If you intentionally want to test the optional local analyzer backend:

```bash
cd backend
npm install
npm start
```

Then set `EXPO_PUBLIC_ANALYZER_URL` in `.env` to your local network backend URL.

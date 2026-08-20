# Cloud Sync

GigKit contains an experimental Firebase-based cloud layer intended for future
features such as multi-device synchronization, account-based backup, desktop or
web sync, and sharing between band members.

The released application is local-first. Cloud sync is disabled by default, and
normal app startup does not initialize Firebase, start Firebase Auth listeners,
read from Firestore, or upload local data.

The feature flag is controlled by `EXPO_PUBLIC_ENABLE_CLOUD_SYNC`. Expo exposes
it through `app.config.js` as `ENABLE_CLOUD_SYNC`, and
`src/features/cloudSync/config.ts` treats only the literal value `true` as
enabled.

To reactivate this layer intentionally:

1. Provide Firebase configuration through environment variables.
2. Set `EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true`.
3. Re-enable any account UI that should expose sign-in to users.
4. Test local data, auth, sync, merge, delete, and offline behavior before
   release.

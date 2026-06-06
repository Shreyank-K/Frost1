# iOS EAS build fix

This cleaned source package adds `plugins/withDisableUserScriptSandboxing.js` and registers it in `app.json`.

The failed iOS archive stopped in the `Bundle React Native code and images` build phase because Xcode user script sandboxing blocked the React Native bundling script from reading generated iOS project/build paths. The plugin sets `ENABLE_USER_SCRIPT_SANDBOXING=NO` during Expo prebuild so EAS can archive the app.

Generated folders and local secrets were removed from this zip: `node_modules`, `.expo`, `dist`, `.git`, `ios`, `android`, `.env`, backend `.env`, and Supabase temp files.

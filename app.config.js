// Tripwire, not configuration.
//
// The Expo app lives in mobile/. But `expo` is hoisted into the root
// node_modules by npm workspaces, so `npx expo start` run HERE finds the CLI
// and happily starts "a project" at the repo root — one whose package.json has
// no "main", which makes Metro fall back to the legacy pre-expo-router entry
// (node_modules/expo/AppEntry.js, `import App from '../../App'`). The app then
// opens on a red screen reading:
//
//   Unable to resolve module ../../App from <repo>/node_modules/expo/AppEntry.js
//
// Nothing about that message points at the working directory, which is the
// whole problem. So fail here instead, with the answer.
//
// Expo reads this file only when the root is treated as the project, i.e.
// exactly when the mistake has been made. Running from mobile/ never loads it.
module.exports = () => {
  throw new Error(
    [
      '',
      'This is the monorepo root, not the Expo app. Metro has no entry point here.',
      '',
      'Run the app from the mobile workspace instead:',
      '',
      '    cd mobile && npx expo start -c',
      '',
      'or, from this directory:',
      '',
      '    npm start',
      '',
    ].join('\n'),
  );
};

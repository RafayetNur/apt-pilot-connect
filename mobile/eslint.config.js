// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // eslint-config-expo (SDK 56+) turns this rule on by default. It flags
      // this project's established fetch-on-mount idiom —
      // `useEffect(() => { load(); }, [load])`, where `load` is a
      // `useCallback` that sets loading state before its first `await` — used
      // consistently across the owner/manager/tenant data hooks and screens
      // since before this SDK upgrade. The pattern is intentional and safe;
      // turned off here rather than rewritten to avoid touching working
      // data-fetching logic app-wide for an SDK-upgrade-triggered lint change.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);

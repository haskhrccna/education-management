# E2E Testing

End-to-end testing with [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Maestro**: Install from https://maestro.mobile.dev/getting-started/installing-maestro
2. **iOS Simulator**: Boot a simulator (`xcrun simctl list devices` → `xcrun simctl boot <udid>`)
3. **Dev client build**: 
   ```bash
   cd mobile && npx expo run:ios
   ```
4. **Server**: Start with the E2E database:
   ```bash
   cd packages/server
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npm run dev
   ```

## Running Tests

```bash
# All flows in mobile/e2e/flows/
npm run e2e

# Single flow group (e.g. auth)
npm run e2e -- flows/auth
```

## testID Convention

Every interactive element must carry an explicit `testID` prop:
- `<TouchableOpacity testID="login-button">`
- `<Pressable testID="menu-toggle">`
- `<TextInput testID="email-input">`
- `<Switch testID="dark-mode-toggle">`
- `<IconButton testID="close-modal">`

Check compliance with:
```bash
npm run check:testids
```

## covered-screens.json Contract

`mobile/e2e/covered-screens.json` is a JSON array of screen paths (relative to `mobile/`). Each new E2E flow must add its screens to this registry:

```json
["app/(auth)/index.tsx", "app/student/home.tsx"]
```

Future tasks will append screens as flows are written.

## BUGLOG.md

Found a bug during E2E testing? Write it to `mobile/e2e/BUGLOG.md`:
```
## Issue: [Brief title]
- **Severity**: Critical|High|Medium|Low
- **Flow**: flows/xyz
- **Steps**: [Reproduction steps]
- **Expected**: [What should happen]
- **Actual**: [What happened]
```

## No Sleep Rule

Never use `sleep` in flow YAML. Use Maestro's native waits instead:
- `waitForAnimationToFinish`
- `tapOn` (waits for element)
- `back` (waits for navigation)

Waits are deterministic; sleeps are brittle.

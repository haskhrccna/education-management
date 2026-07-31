# E2E Testing

End-to-end testing with [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Maestro**: https://maestro.mobile.dev/getting-started/installing-maestro
2. **iOS Simulator**: `xcrun simctl boot <udid>`
3. **Dev client**: `cd mobile && npx expo run:ios`
4. **Server**: 
   ```bash
   cd packages/server
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npm run dev
   ```

## Running Tests

```bash
npm run e2e              # all flows
npm run e2e -- flows/auth  # single group
```

## testID Convention

Every interactive element needs explicit `testID`: `<TouchableOpacity testID="x">`, `<Pressable testID="y">`, `<TextInput testID="z">`, `<Switch testID="a">`, `<IconButton testID="b">`.

Verify with: `npm run check:testids`

## covered-screens.json

Registry of screens (relative paths) requiring testID validation. Example:
```json
["app/(auth)/index.tsx", "app/student/home.tsx"]
```
Future tasks append screens as flows are written.

## BUGLOG.md

Found a bug? Log it to `mobile/e2e/BUGLOG.md`:
```
## Issue: [Title]
- **Severity**: Critical|High|Medium|Low
- **Flow**: flows/xyz
- **Steps**: [Reproduce]
- **Expected**: [Should do]
- **Actual**: [Does do]
```

## No Sleep Rule

Never `sleep` in flow YAML. Use Maestro waits: `waitForAnimationToFinish`, `tapOn`, `back`. Waits are deterministic; sleeps are brittle.

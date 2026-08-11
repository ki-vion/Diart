# Task 6 Report: parseDeNumber space-thousands coverage

## Status
**Complete**

## Changes

### `desktop/src/extractor/utils.test.ts`
- Added test `parses space as thousands separator` for `parseDeNumber("2 225,27")` → `2225.27` (FPF-style amounts).

### `desktop/src/extractor/utils.ts`
- No changes. Existing `replace(/\s+/g, "")` already handles space thousands.

## Tests
```
cd desktop
npm run test:run -- src/extractor/utils.test.ts
→ 4 passed (1 file)
```

## Commit
```
test: cover parseDeNumber with space thousands
```
(0c7e3a6)

## Concerns
- None.

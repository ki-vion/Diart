### Task 6: `parseDeNumber` space-thousands coverage

**Files:**
- Modify: `desktop/src/extractor/utils.test.ts`
- Modify: `desktop/src/extractor/utils.ts` only if a test fails

**Interfaces:**
- Consumes/Produces: existing `parseDeNumber(s: string): number | null`

Note: implementation already strips whitespace (`replace(/\s+/g, "")`). This task only locks FPF-style amounts.

- [ ] **Step 1: Add failing-or-passing test**

```ts
it("parses space as thousands separator", () => {
  expect(parseDeNumber("2 225,27")).toBeCloseTo(2225.27);
});
```

- [ ] **Step 2: Run**

```bash
cd desktop
npm run test:run -- src/extractor/utils.test.ts
```

Expected: PASS with current impl; if FAIL, fix `utils.ts` minimally.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/extractor/utils.test.ts desktop/src/extractor/utils.ts
git commit -m "$(cat <<'EOF'
test: cover parseDeNumber with space thousands

EOF
)"
```

---

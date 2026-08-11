# Review Task 6
BASE: 3443cf6ba18116083afe5165788efcdaba3aca8a HEAD: 0c7e3a608dc1f93c3849cdb2c77a01206d24fddc

diff --git a/desktop/src/extractor/utils.test.ts b/desktop/src/extractor/utils.test.ts
index 2306509..705b0e8 100644
--- a/desktop/src/extractor/utils.test.ts
+++ b/desktop/src/extractor/utils.test.ts
@@ -8,10 +8,14 @@ describe("parseDeNumber", () => {
 
   it("parses thousands separators", () => {
     expect(parseDeNumber("1.234,50")).toBeCloseTo(1234.5);
   });
 
+  it("parses space as thousands separator", () => {
+    expect(parseDeNumber("2 225,27")).toBeCloseTo(2225.27);
+  });
+
   it("returns null for empty", () => {
     expect(parseDeNumber("")).toBeNull();
     expect(parseDeNumber("   ")).toBeNull();
   });
 });


# Verification

- Can an old client parse and correctly interpret the new response?
- Did an error code, default, ordering, or rate limit change semantically?
- Can consumers discover deprecation before failure?
- Is the old version operable through the migration window?

Required evidence:
- versioning policy
- consumer contract suite
- compatibility diff
- migration guide

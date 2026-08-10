# Verification

- Can one cheap request trigger many expensive downstream calls?
- Can retries or partial failures double-charge?
- Are per-user, per-tenant, and global caps independent?
- Does cancellation stop already queued cost?

Required evidence:
- cost surface map
- amplification calculations
- abuse test logs
- cap and alert evidence

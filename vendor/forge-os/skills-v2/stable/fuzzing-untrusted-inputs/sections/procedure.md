# Procedure

1. Derive checks from requirements, contracts, invariants, and observed risks.
2. Create a test that can fail for the intended defect class.
3. Inventory every decoder and externally controlled byte or value boundary.
4. Build seed corpora from valid examples, historical failures, boundary values, and protocol dictionaries.
5. Define crash, timeout, memory, invariant, authorization, and differential oracles.
6. Run mutation or grammar-based fuzzing under bounded resources and capture exact seeds.
7. Minimize failures, classify reachability and impact, then promote them to regression fixtures.
8. Run the test against the current system and record the baseline.
9. Exercise positive, negative, boundary, and recovery behavior.
10. Classify findings by impact, reproducibility, and affected scope.
11. Publish evidence without masking critical failures behind aggregate scores.

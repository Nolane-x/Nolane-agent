# Contributing to ForgeOS

ForgeOS accepts contributions that improve measurable agent behavior, verified compatibility, domain coverage, or assurance quality.

## Development workflow

1. Open an issue describing the observed gap and expected artifact contract.
2. Add a failing test or behavioral eval before implementation.
3. Make the smallest sufficient change.
4. Run `npm run release:verify`.
5. Include evidence, compatibility impact, security impact, and migration notes in the pull request.

## Skill contributions

A skill must have a narrow trigger, typed inputs and outputs, explicit gates, failure modes, and a behavioral baseline. A large prompt without eval evidence will not be accepted.

## Adapter contributions

Do not claim upstream certification. Add machine-readable configuration where possible, installation guidance, and TCK evidence.

## Code style

Use focused modules, domain terminology, explicit contracts, immutable history, and no speculative abstraction. Avoid dependencies unless they materially reduce risk or maintenance.

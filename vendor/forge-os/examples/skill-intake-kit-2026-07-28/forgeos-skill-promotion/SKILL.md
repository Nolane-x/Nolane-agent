---
name: forgeos-skill-promotion
description: Use this skill when deciding whether a filtered candidate skill should become a stable ForgeOS provider.
license: MIT
---
# ForgeOS Skill Promotion

Promotion is an evidence decision, not a popularity contest.

## Benchmark design

1. Define at least five representative tasks from the target capability and two adversarial or edge-case tasks.
2. Run the same model, tools, context budget, and seeds without the skill and with the skill.
3. Measure task success, unnecessary tool calls, latency, token usage, policy violations, fabricated claims, and recoverability after failure.
4. Repeat enough runs to distinguish a consistent improvement from random variation.
5. Test coexistence with neighboring skills to detect retrieval collisions and contradictory instructions.

## Promotion gates

Promote only when all conditions hold:

- Task success improves or remains equal while reducing cost or risk.
- No new critical safety or permission failure appears.
- The description retrieves the skill for relevant tasks and avoids irrelevant tasks.
- License and provenance are recorded.
- Required tools exist and expose capability-honest interfaces.
- The skill has an owner, freshness window, revocation path, and regression tests.

## ForgeOS state

Use the progression `candidate -> evaluated -> stable`. A failed regression returns the skill to `candidate` or disables it. Never overwrite the prior signed record; create a new version linked to the old one.

## Verification

Attach benchmark inputs, outputs, verifier results, environment fingerprint, source snapshot, and promotion decision to the catalog entry.

## Failure handling

If the skill has no measurable benefit, keep it out of the stable catalog even when its Markdown appears polished.

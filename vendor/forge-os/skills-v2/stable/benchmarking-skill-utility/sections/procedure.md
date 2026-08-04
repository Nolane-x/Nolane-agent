# Procedure

1. Identify the measured agent failure or capability gap.
2. Write a baseline scenario that exposes the gap without the candidate skill.
3. Define representative cases, success criteria, judge rubric, models, seeds, and token budgets before running.
4. Run baseline and candidate conditions with identical task inputs and tool availability.
5. Blind judges to condition where possible and separate task success from style preference.
6. Calculate pass-rate, quality, critical failures, token growth, latency, and variance.
7. Promote only measurable gains; quarantine regressions and token-only growth.
8. Design the smallest skill or adapter change that targets the failure.
9. Run paired behavioral evaluations across representative agents.
10. Measure success, quality, context, cost, and new failure modes.
11. Promote, revise, deprecate, or quarantine based on evidence.

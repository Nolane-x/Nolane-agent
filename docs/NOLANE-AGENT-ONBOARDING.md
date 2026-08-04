# Nolane Agent onboarding

Nolane Agent is a local-first agent workspace. The first-run path is deliberately short and proof-oriented.

## 1. Choose a workspace

Select a repository or folder that Nolane Agent may read. Write access remains scoped to the selected workspace unless an explicit approval grants a narrower, temporary exception.

## 2. Choose intelligence

Connect a local model or configure an API provider. The interface distinguishes `Connected`, `Needs configuration`, and `Unavailable`; it does not treat a configured provider as evidence that an autonomous run has succeeded.

## 3. Choose an autonomy preset

- **Safe:** read, plan, and request approval before material changes.
- **Balanced:** edit inside an isolated workspace and verify before review.
- **Autonomous:** perform reversible work within declared budgets, while destructive or external actions still require policy approval.

## 4. Start a mission

Describe an outcome, attach relevant files, and choose one of four intents: Ask, Plan, Build, or Verify. Nolane Agent reports actual phases and receipts. It does not display fabricated percentage progress.

## 5. Review before shipping

Use Review & Ship to inspect changed files, tests, risks, evidence, rollback scope, and the selected delivery action. A passing smoke fixture is labelled as a plumbing check, not as proof of model capability.

# Procedure

1. Read verified artifacts and acceptance contracts.
2. Slice work into independently reviewable vertical increments.
3. Map verified requirements and acceptance contracts to concrete files, interfaces, migrations, and tests.
4. Split work where a reviewer could approve one deliverable and reject the next.
5. For each task, write a failing test, expected failure, minimal implementation, focused verification, regression command, and commit boundary.
6. Declare exact consumed and produced interfaces so tasks can be executed out of conversational order.
7. Run a coverage review against the specification and remove placeholders, speculative work, and inconsistent names.
8. Declare exact files, interfaces, dependencies, and test commands.
9. Sequence tasks by dependency and risk, not convenience.
10. Attach a reviewer gate and evidence requirement to every task.
11. Publish an executable plan with no placeholders.

# Verification

- Can two workers perform the side effect?
- What happens when the provider succeeds but the response is lost?
- Is the key scoped to the correct tenant and operation?
- Can an operator distinguish retry from new intent?

Required evidence:
- idempotency contract
- state machine
- concurrency tests
- reconciliation runbook

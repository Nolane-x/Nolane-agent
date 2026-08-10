const recipe = (focus, steps, verification, evidence, traps = []) => ({ focus, steps, verification, evidence, traps, source: 'flagship' });
const candidateRecipe = recipe;

export const SKILL_OVERRIDES = Object.freeze({
  'using-forge-os': recipe(
    'route one project from confirmed intent to the next evidence-backed state without loading unrelated skills',
    ['Read only the project header, current gate, open findings, direct artifact hashes, and confirmed decisions.', 'Compute missing gate artifacts before selecting any skill.', 'Exclude skills with failed preconditions, unavailable tools, conflicts, quarantine status, or assurance mismatch.', 'Activate the smallest non-conflicting skill set that can close the current evidence gap.', 'Commit the route explanation, context budget, stop condition, and invalidation impact before dispatch.'],
    ['Can every selected skill name a missing gate artifact?', 'Would removing any selected skill leave the same gate achievable?', 'Are human decisions and critical findings represented explicitly?', 'Does the context pack omit unrelated history and full skill bodies?'],
    ['route-decision.json', 'context-pack manifest', 'current gate snapshot'],
    ['loading every skill', 'routing by keyword alone', 'advancing a stage from conversational confidence']
  ),
  'resolving-user-intent': recipe(
    'convert ambiguous product language into explicit goals, users, constraints, non-goals, success measures, and decision ownership',
    ['Separate stated facts from model interpretations and unresolved questions.', 'Classify missing information by materiality: blocking, important, or safely deferrable.', 'Ask one decision-sized question at a time and prefer bounded choices when they preserve intent.', 'Reflect the answer back as a change to the intent artifact rather than as chat memory.', 'Request explicit confirmation only after contradictions and hidden assumptions are exposed.'],
    ['Could two competent teams build materially different products from this intent?', 'Is each success measure observable?', 'Are constraints distinguished from preferences?', 'Has the user confirmed every decision that changes scope, risk, cost, or irreversibility?'],
    ['confirmed-intent artifact', 'open-question ledger', 'decision log'],
    ['guessing a target user', 'treating examples as requirements', 'asking a batch of unrelated questions']
  ),
  'routing-skill-graph': recipe(
    'select skills using lifecycle state, typed dependencies, risk, tools, utility history, conflicts, and context cost',
    ['Build an eligibility set from contract preconditions before scoring.', 'Score state match, artifact need, domain fit, assurance fit, available tools, measured utility, and context cost separately.', 'Apply hard exclusions before soft ranking.', 'Resolve conflicts by preferring the route that satisfies the gate with fewer assumptions and less context.', 'Persist route reasons so the same state produces deterministic ordering.'],
    ['Do ineligible skills ever receive a score?', 'Is ordering deterministic under equal inputs?', 'Can a quarantined skill be activated indirectly?', 'Does the route explain both inclusion and exclusion?'],
    ['eligibility matrix', 'ranked route', 'exclusion reasons', 'context estimate'],
    ['flat keyword search', 'popularity-based routing', 'ignoring negative utility evidence']
  ),
  'compiling-context-pack': recipe(
    'compile the minimum sufficient context needed for one skill cell while preserving provenance and freshness',
    ['Start from declared consumes and traverse only direct dependencies within the reference-depth budget.', 'Represent large project structures through stable IDs, hashes, signatures, and deltas.', 'Include unresolved findings and decisions that constrain the output.', 'Reject stale artifacts whose hashes no longer match the graph.', 'Emit an explicit omission list so the worker knows what was deliberately excluded.'],
    ['Can the task be completed without asking for already-known facts?', 'Can each included item be traced to a contract requirement?', 'Is any full file or conversation included when a symbol or artifact slice would suffice?', 'Are freshness hashes checked?'],
    ['context manifest', 'artifact hashes', 'omission list', 'token estimate'],
    ['dumping the repository', 'repeating the user brief', 'using stale summaries']
  ),
  'managing-artifact-lineage': recipe(
    'preserve immutable provenance, dependency edges, supersession, verification, and downstream invalidation',
    ['Assign stable project-scoped IDs and canonical content hashes.', 'Record producing skill, agent identity, consumed artifacts, decisions, evidence, and residual risks.', 'Append new versions; never mutate previously verified content in place.', 'When upstream content changes, compute descendants and mark only affected artifacts invalidated.', 'Require independent verification before changing state to verified.'],
    ['Does the same canonical content produce the same hash?', 'Can every output reconstruct its input lineage?', 'Are unaffected branches preserved during invalidation?', 'Can a worker verify its own artifact?'],
    ['lineage graph', 'hash manifest', 'invalidation report', 'verification record'],
    ['overwriting verified artifacts', 'global invalidation', 'missing decision provenance']
  ),
  'validating-source-credibility': recipe(
    'assess authority, recency, directness, methodology, conflicts, corroboration, and claim-specific relevance',
    ['Decompose each product claim into the evidence it actually requires.', 'Prefer primary and authoritative sources; record when only secondary evidence exists.', 'Check publication date, version, scope, methodology, and incentives.', 'Corroborate load-bearing claims through independent sources where possible.', 'Attach confidence and limitations to each claim, not only to the document.'],
    ['Does the source support the exact claim being made?', 'Could the fact have changed since publication?', 'Are disagreements represented rather than averaged away?', 'Is an inference labeled as an inference?'],
    ['source ledger', 'claim-to-source matrix', 'freshness record', 'confidence notes'],
    ['citation laundering', 'using popularity as authority', 'citing a source that only mentions the topic']
  ),
  'generating-divergent-concepts': recipe(
    'produce mechanism-distinct concepts while delaying cross-agent anchoring and selection',
    ['Freeze the creative brief, forbidden defaults, resource limits, and evaluation frame.', 'Dispatch independent lenses that cannot see one another’s candidates during the first pass.', 'Require each candidate to specify user, hidden problem, trigger, mechanism, interface, incentive, distribution, assumptions, and cheapest experiment.', 'Force a second pass through inversion, removal, extreme constraints, and cross-domain mechanism transfer.', 'Cluster by mechanism and regenerate any region represented only by naming or feature variation.'],
    ['Do candidates differ in causal mechanism rather than wording?', 'Did any candidate merely add AI, automation, or gamification?', 'Were independent branches preserved before synthesis?', 'Can every candidate be falsified cheaply?'],
    ['idea genomes', 'lens provenance', 'semantic clusters', 'forbidden-pattern report'],
    ['brainstorming in one shared thread', 'selecting during generation', 'counting renamed variants as diversity']
  ),
  'constructing-idea-genomes': recipe(
    'encode ideas into comparable causal components rather than persuasive prose',
    ['Extract target user, hidden problem, trigger, mechanism, interface, resource, incentive, ownership, time model, distribution, value, assumptions, and failure modes.', 'Normalize each field to one causal statement and remove marketing adjectives.', 'Mark inherited components versus novel mutations.', 'Generate a semantic fingerprint from mechanism-level fields.', 'Reject incomplete genomes before scoring or recombination.'],
    ['Could another agent reconstruct the same concept from the genome?', 'Does the mechanism explain how value is created?', 'Are assumptions independently testable?', 'Would a title change leave the fingerprint unchanged?'],
    ['idea-genome artifact', 'semantic fingerprint', 'assumption list'],
    ['using a pitch deck as the data model', 'leaving mechanism blank', 'encoding novelty only in the title']
  ),
  'detecting-fake-novelty': recipe(
    'distinguish new causal mechanisms from renamed, bundled, randomized, or AI-decorated existing patterns',
    ['Identify the closest existing product or system pattern.', 'Reduce both candidate and comparator to target, mechanism, interface, incentive, distribution, and ownership.', 'Count meaningful axis differences and identify dependencies on existing mechanisms.', 'Search prior art only after the unconstrained generation pass to avoid premature anchoring.', 'Classify novelty as surface, configuration, mechanism, system, or problem-reframing.'],
    ['Would the concept still be new without its name and branding?', 'Is adding an LLM the only difference?', 'Are at least three material axes different?', 'Is the novelty claim bounded to the evidence searched?'],
    ['closest-pattern analysis', 'difference matrix', 'prior-art map', 'novelty classification'],
    ['claiming “never done before”', 'equating rarity with usefulness', 'rewarding random combinations']
  ),
  'selecting-winning-concept': recipe(
    'select a product direction through evidence, pairwise trade-offs, and explicit human ownership',
    ['Reject candidates that fail non-negotiable constraints before scoring.', 'Compare pairs separately on novelty, usefulness, feasibility, leverage, defensibility, testability, clarity, and evidence.', 'Run assumption sensitivity to identify candidates whose rank collapses under plausible changes.', 'Present practical, bold-plausible, and weirdly-useful finalists rather than one blended list.', 'Record the human selection, rationale, rejected alternatives, and invalidated downstream work.'],
    ['Can the winner explain why it beats the runner-up?', 'Is a high novelty score hiding poor usefulness?', 'Has the human—not the worker—owned the final product direction?', 'Is the cheapest falsification experiment defined?'],
    ['pairwise matrix', 'sensitivity report', 'selection decision', 'rejected-alternative record'],
    ['averaging incompatible criteria', 'letting the generator self-select', 'choosing the most polished prose']
  ),
  'defining-minimum-viable-product': recipe(
    'identify the smallest end-to-end product that tests the product thesis rather than a pile of disconnected features',
    ['State the product thesis and riskiest causal assumption.', 'Map the single critical user journey that can falsify the thesis.', 'Include only capabilities required to complete and measure that journey.', 'Define operational, security, accessibility, and recovery minimums that cannot be deferred.', 'Move every other capability to a later hypothesis with an explicit trigger for reconsideration.'],
    ['Does the MVP deliver user value end to end?', 'Can it test the riskiest assumption?', 'Are reliability and security basics treated as scope, not polish?', 'Can every included feature name the thesis dependency it serves?'],
    ['MVP capability map', 'critical journey', 'non-goal list', 'experiment plan'],
    ['feature-count MVPs', 'prototype shortcuts in production', 'building infrastructure without a user loop']
  ),
  'designing-interaction-contracts': recipe(
    'specify complete user-system behavior across states, errors, latency, permissions, recovery, and accessibility',
    ['Enumerate user intents and system states for each critical interaction.', 'Define input constraints, feedback, optimistic behavior, loading, empty, partial, error, permission, and recovery states.', 'Specify keyboard, screen-reader, focus, motion, and responsive behavior.', 'Map each visible state to backend contracts and telemetry.', 'Create executable acceptance scenarios before visual polish.'],
    ['Is every asynchronous action observable and recoverable?', 'Can a keyboard-only user complete the critical flow?', 'Do frontend states correspond to real backend outcomes?', 'Are destructive actions reversible or explicitly confirmed?'],
    ['interaction state table', 'accessibility contract', 'acceptance scenarios', 'backend mapping'],
    ['happy-path mockups only', 'inventing backend states', 'using color as the only signal']
  ),
  'choosing-system-architecture': recipe(
    'select the simplest architecture that satisfies quality attributes, failure boundaries, extension needs, and operational constraints',
    ['Translate product capabilities into measurable quality attributes and workload assumptions.', 'Model at least two viable architectures with boundaries, data ownership, failure propagation, deployment, and cost.', 'Use decision drivers and disqualifiers rather than trend preference.', 'Threat-model and operate the leading option on paper, including migration and rollback.', 'Record the decision, rejected alternatives, assumptions, validation experiments, and expiry conditions.'],
    ['Can the architecture be explained through bounded responsibilities?', 'Is each added component justified by a current quality attribute?', 'What happens when every dependency is slow, unavailable, or duplicated?', 'Which future change would force this decision to be revisited?'],
    ['architecture decision record', 'quality-attribute scenarios', 'failure map', 'validation plan'],
    ['architecture by fashion', 'microservices without isolation needs', 'future-proof layers without consumers']
  ),
  'designing-api-contracts': recipe(
    'define stable request, response, error, idempotency, authorization, pagination, versioning, and observability contracts before implementation',
    ['Map API operations to user and domain capabilities rather than database tables.', 'Define schemas, constraints, examples, errors, side effects, authorization, and idempotency semantics.', 'Specify pagination, filtering, concurrency control, rate limits, retries, and backward compatibility.', 'Generate consumer and provider contract tests from the same specification.', 'Review sensitive fields, tenant boundaries, and logging behavior before implementation.'],
    ['Can a client recover from every documented error?', 'Are retries safe and duplicate requests defined?', 'Does authorization apply to each object and action?', 'Can an old client continue after a compatible server change?'],
    ['API specification', 'contract tests', 'error catalog', 'compatibility report'],
    ['CRUD-shaped APIs', 'undocumented 500 responses', 'breaking optional fields']
  ),
  'writing-executable-plans': recipe(
    'produce a dependency-aware sequence of vertical increments that a fresh agent can execute and independently verify',
    ['Map verified requirements and acceptance contracts to concrete files, interfaces, migrations, and tests.', 'Split work where a reviewer could approve one deliverable and reject the next.', 'For each task, write a failing test, expected failure, minimal implementation, focused verification, regression command, and commit boundary.', 'Declare exact consumed and produced interfaces so tasks can be executed out of conversational order.', 'Run a coverage review against the specification and remove placeholders, speculative work, and inconsistent names.'],
    ['Can an agent with no prior chat execute each task?', 'Does every requirement map to a task and acceptance test?', 'Does every task end in an independently testable artifact?', 'Are exact paths, signatures, commands, and expected outputs present?'],
    ['implementation plan', 'requirement-to-task matrix', 'dependency DAG', 'plan self-review'],
    ['“implement as needed”', 'horizontal layer tasks with no user value', 'tests deferred to the end']
  ),
  'developing-features-with-tdd': recipe(
    'implement one externally observable feature through a verified red-green-refactor cycle',
    ['Write the smallest behavior test from the acceptance contract before production code.', 'Run it and confirm it fails for the intended missing behavior rather than setup or syntax.', 'Implement only enough behavior to pass, then run the focused and relevant regression suites.', 'Refactor only while all tests remain green and no behavior changes.', 'Record the red output, green output, diff review, and remaining risks.'],
    ['Was the failure observed before implementation?', 'Does the test assert behavior rather than mocks or internals?', 'Did implementation add anything not demanded by the test?', 'Are warnings and unrelated regressions zero?'],
    ['red test log', 'green test log', 'diff review', 'commit hash'],
    ['tests written after code', 'broad mocks hiding integration behavior', 'speculative options and abstractions']
  ),
  'writing-minimal-sufficient-code': recipe(
    'minimize code, dependencies, layers, and state while fully satisfying contracts, risks, and operability',
    ['List required behaviors, quality attributes, and extension points that have current consumers.', 'Choose the fewest concepts that make invalid states hard to represent.', 'Delete duplicate paths, speculative flags, pass-through layers, and narration-shaped abstractions.', 'Measure complexity through public surface, branches, state transitions, dependencies, and change amplification—not line count alone.', 'Verify behavior and readability after simplification.'],
    ['Does every public abstraction have at least one real consumer?', 'Can a layer be removed without losing a contract or boundary?', 'Is configuration replacing a missing product decision?', 'Did simplification preserve tests, observability, and security?'],
    ['complexity budget', 'deleted-code diff', 'behavior regression report'],
    ['code golf', 'premature frameworks', 'one interface per class without substitution']
  ),
  'reviewing-critical-code-line-by-line': recipe(
    'review high-impact code with complete data-flow, control-flow, failure, concurrency, and trust-boundary coverage',
    ['Define why the module is critical and identify assets, callers, side effects, invariants, and failure consequences.', 'Trace every input from origin through validation, transformation, authorization, persistence, and output.', 'Review each branch, error path, cleanup path, retry, timeout, and concurrent interleaving.', 'Cross-check code against requirements, tests, dependency behavior, and operational telemetry.', 'Record findings with exact lines, exploit or failure scenario, severity, and required evidence for closure.'],
    ['Can malformed, stale, duplicated, reordered, or unauthorized input reach a side effect?', 'Can partial failure leave durable corruption or cost?', 'Do tests kill plausible mutations in critical branches?', 'Can logs or errors disclose secrets?'],
    ['annotated diff', 'data-flow map', 'finding ledger', 'closure evidence'],
    ['style-only review', 'trusting test coverage percentage', 'reviewer silently fixing findings']
  ),
  'testing-properties-and-invariants': recipe(
    'verify domain invariants across generated inputs, state transitions, serialization, retries, and boundary combinations',
    ['Extract invariants from domain and acceptance contracts.', 'Define generators that cover valid, invalid, boundary, and structurally diverse values.', 'Use shrinking to minimize failing cases and persist seeds.', 'Test invariants across round trips, permutations, retries, and state transitions.', 'Convert every discovered counterexample into a deterministic regression fixture.'],
    ['Is the property stronger than a handful of examples?', 'Can the generator reach boundary structures?', 'Is non-determinism seeded and reproducible?', 'Does shrinking preserve the failure cause?'],
    ['property catalog', 'generator definitions', 'seed corpus', 'minimized regressions'],
    ['tautological properties', 'random tests without reproducibility', 'discarding too many generated cases']
  ),
  'fuzzing-untrusted-inputs': recipe(
    'exercise parsers, protocol boundaries, file formats, and user-controlled fields with structured malformed input',
    ['Inventory every decoder and externally controlled byte or value boundary.', 'Build seed corpora from valid examples, historical failures, boundary values, and protocol dictionaries.', 'Define crash, timeout, memory, invariant, authorization, and differential oracles.', 'Run mutation or grammar-based fuzzing under bounded resources and capture exact seeds.', 'Minimize failures, classify reachability and impact, then promote them to regression fixtures.'],
    ['Does the fuzzer reach deep parser states?', 'Are hangs and resource exhaustion treated as failures?', 'Can the same seed reproduce the issue?', 'Are sensitive production systems excluded from unsafe fuzzing?'],
    ['seed corpus', 'fuzz configuration', 'crash or hang artifacts', 'minimized regression cases'],
    ['random strings only', 'unbounded fuzz execution', 'closing crashes without regression tests']
  ),
  'measuring-mutation-resistance': recipe(
    'measure whether tests detect plausible incorrect implementations rather than merely execute lines',
    ['Select mutation operators that represent realistic defects for the language and domain.', 'Exclude generated, unreachable, and non-behavioral code with recorded reasons.', 'Run mutations against focused suites and classify killed, survived, timed out, and uncovered mutants.', 'Review surviving mutants in critical logic before using a global score.', 'Add behavior tests that kill meaningful survivors without asserting implementation details.'],
    ['Do critical branches have surviving mutants?', 'Is the score inflated by trivial code?', 'Can each added test explain the defect it detects?', 'Are equivalent mutants documented rather than silently ignored?'],
    ['mutation report', 'critical-survivor list', 'new regression tests', 'exclusion rationale'],
    ['chasing 100% blindly', 'counting timeouts as killed', 'snapshot tests that miss semantic changes']
  ),
  'modeling-security-threats': recipe(
    'model assets, trust boundaries, actors, entry points, abuse cases, controls, and residual risk before implementation',
    ['Draw data and control flows across human, agent, tool, network, storage, and third-party boundaries.', 'Enumerate assets and attacker goals, including cost, privacy, integrity, availability, and model manipulation.', 'Apply threat categories to each boundary and state transition.', 'Map preventive, detective, and recovery controls to concrete tests and owners.', 'Prioritize by plausible impact and exposure; record residual risk and review triggers.'],
    ['Does the model include the AI agent and tool outputs as untrusted?', 'Are cross-tenant and confused-deputy paths covered?', 'Are cost and supply-chain attacks represented?', 'Does every high risk map to a test or accepted residual risk?'],
    ['threat model', 'abuse-case catalog', 'control-to-test matrix', 'residual-risk register'],
    ['checklist without system flows', 'ignoring insiders and automation', 'treating the model provider as trusted code']
  ),
  'testing-agent-tool-abuse': recipe(
    'verify that untrusted prompts, retrieved content, and agent outputs cannot exceed tool authority or bypass human decisions',
    ['Enumerate tools, permissions, side effects, irreversible actions, and authority delegation paths.', 'Construct indirect prompt injection, tool argument manipulation, cross-context, replay, and confused-deputy scenarios.', 'Verify server-side schema, authorization, scope, idempotency, and human confirmation independently of model compliance.', 'Test least-privilege degradation when a tool or model is compromised.', 'Record exploit traces without exposing live credentials or harming external systems.'],
    ['Can content from a file or webpage cause a privileged call?', 'Can the model invent a confirmation token?', 'Are read-only and destructive annotations truthful?', 'Can tool output inject a second instruction into the agent?'],
    ['abuse-case suite', 'tool permission matrix', 'blocked exploit traces', 'residual-risk report'],
    ['prompt-only defenses', 'trusting model refusal', 'testing against production accounts']
  ),
  'testing-cost-abuse': recipe(
    'find attacker-controlled paths that amplify metered compute, model, storage, notification, or third-party spend',
    ['Inventory every metered operation and calculate cost per request, retry, fan-out, and retained artifact.', 'Model attacker budget versus defender cost amplification.', 'Exercise burst, replay, concurrency, recursive workflows, oversized context, cache busting, and failed-payment paths.', 'Verify quotas, idempotency, backpressure, cancellation, spending caps, and anomaly alerts server-side.', 'Calculate worst-case daily exposure and require explicit acceptance when it exceeds the product risk budget.'],
    ['Can one cheap request trigger many expensive downstream calls?', 'Can retries or partial failures double-charge?', 'Are per-user, per-tenant, and global caps independent?', 'Does cancellation stop already queued cost?'],
    ['cost surface map', 'amplification calculations', 'abuse test logs', 'cap and alert evidence'],
    ['rate limits without cost modeling', 'average-case unit economics', 'alerts without hard caps']
  ),
  'running-security-release-gate': recipe(
    'make a release decision from unresolved findings, required controls, test evidence, provenance, and explicit residual-risk ownership',
    ['Resolve the assurance profile and enumerate mandatory security evidence.', 'Verify every critical and high finding against closure evidence rather than status labels.', 'Check dependency, secret, authorization, tenant, prompt injection, tool abuse, rollback, and incident readiness evidence.', 'Reject aggregate scores that hide a critical blocker.', 'Emit pass, fail, or blocked with exact rule IDs, remediation, owner, and evidence hashes.'],
    ['Are any findings accepted without exact human confirmation?', 'Do evidence hashes match the release candidate?', 'Can the build be reproduced and rolled back?', 'Are monitoring and incident owners ready before exposure?'],
    ['security gate result', 'finding closure matrix', 'release hash manifest', 'residual-risk acceptance'],
    ['waiving findings in chat', 'using stale scans', 'approving a different build than the one tested']
  ),
  'packaging-release-evidence': recipe(
    'assemble a reproducible release dossier linking requirements, build identity, tests, findings, migrations, rollback, and residual risks',
    ['Freeze the release candidate and record source, dependency, build, and artifact hashes.', 'Collect requirement traceability, test logs, coverage, mutation, fuzz, security, UX, performance, compatibility, migration, and rollback evidence required by assurance.', 'Verify evidence freshness and that every report targets the frozen candidate.', 'List unresolved findings and exact human acceptances without summarizing them away.', 'Generate a machine-readable dossier plus a concise human release decision.'],
    ['Can another reviewer reproduce each verification command?', 'Do screenshots and logs identify the tested version?', 'Are missing evidence and skipped controls explicit?', 'Does the dossier distinguish tested claims from assumptions?'],
    ['release dossier', 'hash manifest', 'traceability matrix', 'known-risk register'],
    ['copying CI badges', 'mixing evidence from different commits', 'claiming defect-free software']
  ),
  'testing-skill-behavior': recipe(
    'prove that a skill changes agent behavior under realistic pressure rather than merely sounding persuasive',
    ['Create a baseline scenario that exposes the target failure without the skill.', 'Record the agent’s exact choices, omissions, and rationalizations.', 'Add the smallest skill guidance that targets the observed failure form.', 'Repeat across task variations, pressure combinations, models, and context sizes.', 'Measure compliance, output quality, task success, token cost, and new failure modes before promotion.'],
    ['Was a failing baseline observed?', 'Does the skill improve behavior beyond one prompt seed?', 'Does it create a new regression or context burden?', 'Can an agent recognize when the skill should not apply?'],
    ['baseline transcripts', 'candidate transcripts', 'scored comparison', 'rationalization catalog'],
    ['testing only comprehension', 'editing the skill during the candidate run', 'promoting from one success']
  ),
  'benchmarking-skill-utility': recipe(
    'measure marginal task success and quality attributable to a skill under controlled comparisons',
    ['Define representative cases, success criteria, judge rubric, models, seeds, and token budgets before running.', 'Run baseline and candidate conditions with identical task inputs and tool availability.', 'Blind judges to condition where possible and separate task success from style preference.', 'Calculate pass-rate, quality, critical failures, token growth, latency, and variance.', 'Promote only measurable gains; quarantine regressions and token-only growth.'],
    ['Are the cases representative of the trigger description?', 'Are baseline and candidate conditions otherwise identical?', 'Do improvements survive multiple models or seeds?', 'Are critical failures weighted as blockers?'],
    ['eval corpus', 'run manifest', 'paired results', 'promotion decision'],
    ['cherry-picked examples', 'LLM judge without calibration', 'rewarding verbosity']
  ),
  'optimizing-context-budget': recipe(
    'remove redundant context while preserving every fact, contract, dependency, and risk needed for correct execution',
    ['Measure current context by source, reuse, freshness, and decision value.', 'Replace repeated structures with stable IDs, hashes, signatures, and deltas.', 'Separate global metadata, selected skill bodies, direct artifacts, and on-demand references.', 'A/B test compressed and full contexts on task success and critical omissions.', 'Reject savings that reduce correctness, evidence quality, or recovery ability.'],
    ['Is any removed fact load-bearing?', 'Can the agent retrieve omitted detail on demand?', 'Are stale summaries prevented by hashes?', 'Did token reduction increase retries or rework?'],
    ['context profile', 'compressed pack', 'A/B results', 'omission audit'],
    ['arbitrary token caps', 'summarizing code semantics away', 'repeating instructions in every artifact']
  ),
  'designing-saas-tenancy': recipe(
    'define tenant identity, data ownership, isolation, provisioning, lifecycle, and operational boundaries',
    ['Choose tenancy model from isolation, cost, scale, compliance, and migration requirements.', 'Define tenant context propagation through authentication, authorization, storage, queues, caches, logs, and background jobs.', 'Make every tenant-scoped query and side effect structurally require tenant identity.', 'Plan provisioning, suspension, deletion, export, backup, restore, and tenant migration.', 'Create cross-tenant negative tests and operational detection signals.'],
    ['Can any identifier be used without tenant context?', 'Are caches and async jobs tenant-safe?', 'Can administrators cross boundaries only through audited authority?', 'Can one tenant be restored or deleted without affecting others?'],
    ['tenancy decision', 'tenant data map', 'isolation test suite', 'lifecycle runbook'],
    ['tenant ID filtering by convention', 'shared cache keys', 'support impersonation without audit']
  ),
  'designing-idempotent-automations': recipe(
    'make repeated, delayed, reordered, or retried automation executions produce one intended outcome',
    ['Identify the business operation and define its idempotency boundary.', 'Choose stable keys from event identity and operation scope; define retention and collision behavior.', 'Persist claim, progress, result, and terminal failure atomically with side-effect ordering.', 'Handle concurrent claims, partial external success, provider timeouts, and replay.', 'Expose operator-safe retry, reconciliation, and audit evidence.'],
    ['Can two workers perform the side effect?', 'What happens when the provider succeeds but the response is lost?', 'Is the key scoped to the correct tenant and operation?', 'Can an operator distinguish retry from new intent?'],
    ['idempotency contract', 'state machine', 'concurrency tests', 'reconciliation runbook'],
    ['in-memory deduplication', 'retrying non-idempotent calls blindly', 'keys derived from timestamps']
  ),
  'designing-model-routing': recipe(
    'route AI requests by capability, risk, latency, cost, context, privacy, and measured task quality',
    ['Classify task type, required capabilities, data sensitivity, assurance, latency, and maximum spend.', 'Maintain provider/model profiles from measured evals rather than marketing claims.', 'Define deterministic primary, fallback, timeout, retry, and degradation policies.', 'Preserve prompt, tool, schema, and safety compatibility across routes.', 'Record route decision, model version, cost, latency, quality evidence, and failure reason.'],
    ['Can a cheaper model safely handle the task class?', 'Does fallback change output contracts or privacy boundaries?', 'Are retries capable of multiplying cost or side effects?', 'Can routing be replayed and audited?'],
    ['routing policy', 'model eval matrix', 'fallback tests', 'cost and latency trace'],
    ['routing by brand', 'silent model upgrades', 'fallback loops without budgets']
  ),
  'designing-api-versioning': recipe(
    'evolve public API behavior without surprising existing consumers',
    ['Classify compatibility across syntax, semantics, errors, defaults, performance, and side effects.', 'Choose versioning surface and support window from consumer deployment realities.', 'Design additive evolution rules and explicit breaking-change triggers.', 'Run recorded consumer contracts against current and candidate implementations.', 'Publish migration tooling, deprecation telemetry, communication, and rollback policy.'],
    ['Can an old client parse and correctly interpret the new response?', 'Did an error code, default, ordering, or rate limit change semantically?', 'Can consumers discover deprecation before failure?', 'Is the old version operable through the migration window?'],
    ['versioning policy', 'consumer contract suite', 'compatibility diff', 'migration guide'],
    ['versioning only the URL', 'silent semantic breaks', 'deprecation without usage telemetry']
  ),
  'designing-production-visual-systems': candidateRecipe(
    'turn a verified product brief into an accessible, reusable visual system rather than a one-off mockup',
    ['Establish audience, brand constraints, target surfaces, accessibility obligations, and measurable visual outcomes.', 'Define semantic color, typography, spacing, elevation, icon, motion, and content tokens with contrast and state rules.', 'Compose representative components and layouts for normal, empty, loading, error, dense, and narrow-screen states.', 'Review visual hierarchy, keyboard focus, text scaling, localization expansion, and image or font licensing against the system.', 'Package source files, export rules, token references, review decisions, and the open questions required before implementation.'],
    ['Can every essential state be understood without color alone?', 'Do representative foreground and background combinations meet the stated contrast target?', 'Can a developer identify the reusable token and component behind each visual choice?', 'Does the delivery distinguish a design specification from a rendered or deployed product?'],
    ['visual-system specification', 'token inventory', 'state and accessibility review', 'asset provenance register'],
    ['treating a static mockup as an implemented interface', 'copying third-party brand assets without rights', 'using color as the only status signal']
  ),
  'validating-visual-asset-delivery': candidateRecipe(
    'verify that a visual asset package is usable, attributable, accessible, and matched to its declared delivery surface',
    ['Inventory every asset with owner, source, license or permission, intended surface, dimensions, color profile, and format.', 'Validate filenames, dimensions, density variants, transparency, safe areas, compression, and fallback behavior against the delivery contract.', 'Check legibility at representative sizes, alt-text or transcript ownership, localization needs, and dark or high-contrast compatibility.', 'Open the exported files in an independent viewer and compare a sample against the source specification without claiming device certification.', 'Publish a manifest of pass, fail, exception, replacement, and unresolved-rights evidence for human release review.'],
    ['Does each asset have a known source and permitted use?', 'Can the declared target surface render the supplied format and dimensions?', 'Are critical messages available as text, caption, or alternative description?', 'Is a successful file-open check kept distinct from production device certification?'],
    ['asset manifest', 'format and dimension checks', 'independent viewer record', 'license and accessibility review'],
    ['assuming an export is licensed because it was downloadable', 'shipping only a high-resolution master', 'calling a local preview a production compatibility guarantee']
  ),
  'designing-interactive-3d-experiences': candidateRecipe(
    'design an interactive 3D experience with explicit runtime, input, accessibility, asset, and device constraints',
    ['Define the user goal, interaction model, supported devices, input methods, comfort constraints, and a non-3D fallback.', 'Specify scene graph, coordinate conventions, asset provenance, level-of-detail policy, loading states, and interaction affordances.', 'Set measurable budgets for startup, frame time, memory, geometry, textures, draw calls, and network payload by target class.', 'Design navigation, focus, keyboard or assistive alternatives, motion reduction, camera behavior, and error recovery before implementation.', 'Deliver an experience contract, representative scene specification, budget table, fallback design, and assumptions requiring runtime validation.'],
    ['Is every primary task possible through the declared supported input methods?', 'Do geometry, texture, startup, memory, and frame budgets name a target device class?', 'Is there a usable fallback when WebGL, GPU, motion, or large assets are unavailable?', 'Are source licenses and coordinate conventions recorded before assets are integrated?'],
    ['interactive-3d experience contract', 'scene and input specification', 'performance budget table', 'fallback and asset provenance review'],
    ['assuming a design file proves runtime performance', 'requiring motion when a reduced-motion path is needed', 'shipping unlicensed models or textures']
  ),
  'testing-interactive-3d-performance': candidateRecipe(
    'measure an implemented interactive 3D experience against declared budgets and preserve evidence for failures and fallbacks',
    ['Freeze the build identity, scene, browser or runtime version, device class, test path, and measurement method.', 'Exercise cold start, asset loading, camera movement, interaction bursts, resize, background or foreground recovery, and fallback activation.', 'Record frame-time distribution, startup, memory, errors, asset requests, visual defects, and input failures against explicit budgets.', 'Repeat representative checks across the declared device matrix and classify unsupported environments separately from regressions.', 'Publish raw traces or screenshots where available, summarized results, reproducible steps, limits, and release-blocking findings.'],
    ['Can another reviewer identify the exact build, device class, scene, and test path?', 'Are p50 and tail latency, memory, startup, and error observations compared with written thresholds?', 'Was the fallback deliberately exercised rather than inferred from source code?', 'Are unsupported or untested devices reported as such instead of silently passed?'],
    ['runtime test matrix', 'performance trace summary', 'fallback exercise record', 'reproducible defect log'],
    ['claiming universal frame-rate performance from one machine', 'testing only a warm cache', 'hiding a fallback failure behind a successful primary path']
  ),
  'engineering-manufacturable-products': candidateRecipe(
    'translate a product concept into a reviewable manufacturability package without authorizing procurement or fabrication',
    ['Define intended use, user environment, safety assumptions, functional requirements, measurable acceptance criteria, and excluded use cases.', 'Establish units, datum scheme, materials, interfaces, critical dimensions, tolerances, finish, serviceability, and revision control.', 'Perform design-for-manufacture and assembly review with supplier-process assumptions, tolerance-stack risks, tooling risks, and alternate components.', 'Create a controlled bill of materials, prototype plan, inspection plan, traceability needs, and test matrix for human engineering review.', 'Publish drawings or models, assumptions, risk register, review decisions, and the explicit approvals required before any build or purchase.'],
    ['Are units, datums, tolerances, materials, and revision identifiers unambiguous?', 'Does the package separate preliminary supplier assumptions from quoted or approved production capability?', 'Can inspection verify each critical requirement with a named method?', 'Does it state that fabrication, procurement, and certification require authorized human decisions?'],
    ['manufacturability specification', 'controlled BOM', 'tolerance and inspection plan', 'prototype risk register'],
    ['using approximate dimensions for safety-critical interfaces', 'assuming a CAD model is production-ready', 'placing orders or approving manufacture from an agent-generated draft']
  ),
  'validating-physical-product-safety': candidateRecipe(
    'build a safety evidence plan for a physical product while keeping certification and real-world testing under qualified human authority',
    ['Identify users, environments, foreseeable misuse, energy sources, hazardous states, applicable jurisdictions, and the safety owner.', 'Perform documented hazard analysis with severity, likelihood, controls, residual risk, safe-state behavior, warnings, and verification method.', 'Define traceable safety requirements, design controls, inspection points, emergency behavior, change-control rules, and incident reporting.', 'Plan prototype, laboratory, environmental, abuse, and failure-mode tests with qualified personnel, equipment, stopping criteria, and records.', 'Produce a review packet that distinguishes planned evidence, observed evidence, unresolved hazards, and any required legal or certification path.'],
    ['Does every material hazard have an owner, control, residual-risk decision, and verification method?', 'Are legal, certification, and laboratory claims explicitly withheld until qualified evidence exists?', 'Do test plans include safe stopping conditions and incident handling?', 'Can a reviewer trace each safety requirement to a test, inspection, or justified exception?'],
    ['hazard analysis', 'safety requirements trace', 'qualified test plan', 'residual-risk review'],
    ['claiming certification from a checklist', 'testing hazardous systems without qualified supervision', 'treating warnings as a substitute for an engineered control']
  ),
  'designing-simulation-to-reality-workflows': candidateRecipe(
    'plan a staged simulation-to-reality workflow with calibrated assumptions, rollback, and human authority before any live actuation',
    ['Define the system boundary, task envelope, operating environment, actuator and sensor authority, hazards, and prohibited actions.', 'Record coordinate frames, units, calibration method, model provenance, sensor noise, latency, contact assumptions, and known simulation gaps.', 'Set acceptance metrics and a staged path from offline analysis to simulation, hardware-in-the-loop, supervised dry run, and separately authorized deployment.', 'Specify safety envelope, command limits, freshness checks, emergency stop ownership, communication-loss behavior, observation, logging, and rollback.', 'Deliver a sim-to-real gap register, calibration protocol, staged test plan, evidence requirements, and named human approvals for each transition.'],
    ['Are simulation assumptions, coordinate frames, calibration, noise, latency, and unmodeled effects explicit?', 'Does every stage have measurable entry criteria, stop conditions, and a rollback owner?', 'Can the system fail to a safe state on stale sensing, communication loss, or out-of-envelope commands?', 'Does the artifact prohibit live actuation unless a separately authorized executor and human controller are present?'],
    ['sim-to-real gap register', 'calibration protocol', 'staged acceptance plan', 'safety and rollback design'],
    ['treating simulator success as deployment evidence', 'mixing coordinate frames or units', 'allowing an agent plan to actuate hardware directly']
  ),
  'testing-physical-ai-deployment-boundaries': candidateRecipe(
    'verify physical-AI deployment boundaries through controlled evidence, without granting an agent authority to operate live equipment',
    ['Freeze software, model, policy, configuration, hardware revision, calibration state, safety envelope, operator, and test environment identity.', 'Exercise simulated or qualified supervised scenarios for normal operation, out-of-envelope requests, stale sensors, communication loss, actuator limits, and emergency stop.', 'Record command intent, policy decision, safety interlock response, observation timestamps, intervention, outcome, and evidence integrity for each run.', 'Compare observed behavior with declared limits and classify each result as pass, fail, blocked, or untested without inferring field reliability.', 'Publish a release-boundary report with replayable inputs where safe, unresolved risks, rollback procedure, human authorization requirements, and prohibited autonomous actions.'],
    ['Can evidence tie each test to a specific build, configuration, calibration, operator, and environment?', 'Were unsafe commands, stale inputs, communication loss, and emergency stop behavior deliberately tested under safe supervision?', 'Does a failed or untested case block the relevant deployment claim?', 'Does the report preserve human authority and forbid direct live control by this skill?'],
    ['physical-AI boundary report', 'interlock and emergency-stop record', 'controlled scenario log', 'rollback and authorization register'],
    ['calling simulation-only checks field validation', 'suppressing operator intervention from evidence', 'allowing a test harness to become an unreviewed live controller']
  )
});

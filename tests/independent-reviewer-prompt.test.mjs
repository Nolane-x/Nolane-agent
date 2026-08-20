import assert from 'node:assert/strict';
import test from 'node:test';

import { independentReviewerSystemPrompt } from '../src/review/independent-reviewer-prompt.mjs';

test('independent reviewer prompt permits bounded public review context without private reasoning', () => {
  const prompt = independentReviewerSystemPrompt();
  assert.match(prompt, /supplied diff and rules/i);
  assert.match(prompt, /requirements, evidence, test receipts, residual risks, and semantic findings/i);
  assert.match(prompt, /Do not request or rely on executor rationale, hidden reasoning, raw prompts, or raw model outputs/i);
  assert.match(prompt, /Do not claim to have run tests/i);
  assert.match(prompt, /Return strict JSON only/i);
});

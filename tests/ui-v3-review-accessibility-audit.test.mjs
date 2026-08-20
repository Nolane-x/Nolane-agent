import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUiV3Accessibility } from '../scripts/audit-ui-v3-accessibility.mjs';
import { createReviewModel, renderReviewView } from '../ui-v3/views/review/review-view.mjs';

test('Review navigation remains explicitly labelled in server and legacy localized surfaces', async () => {
  const audit = await auditUiV3Accessibility({ root: process.cwd() });
  assert.equal(audit.missing.includes('review-navigation-label'), false);

  const model = createReviewModel({ missionId: 'm-review-a11y' });
  model.updateFiles([{ id: 'f1', path: 'src/a.mjs' }]);
  const snapshot = model.snapshot();
  assert.match(renderReviewView(snapshot, { language: 'en' }), /class="change-navigator" aria-label="Changed files"/);
  assert.match(renderReviewView(snapshot, { language: 'vi' }), /class="change-navigator" aria-label="Tệp đã thay đổi"/);
});

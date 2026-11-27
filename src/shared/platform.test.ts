import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReviewStats, validateReviewInput } from './reviews.ts';
import { parseGeminiErrorMessage, sanitizeAiMessages } from './aiHelpers.ts';

test('computeReviewStats returns zero average and empty distribution when there are no reviews', () => {
  const stats = computeReviewStats([]);
  assert.equal(stats.totalReviews, 0);
  assert.equal(stats.averageRating, 0);
  assert.deepEqual(stats.distribution, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
});

test('computeReviewStats computes accurate 1-decimal average and clamped 1..5 distribution', () => {
  const stats = computeReviewStats([{ rating: 5 }, { rating: 5 }, { rating: 4 }]);
  assert.equal(stats.totalReviews, 3);
  assert.equal(stats.averageRating, 4.7);
  assert.deepEqual(stats.distribution, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 });
});

test('validateReviewInput rejects short names and out-of-range ratings', () => {
  assert.equal(validateReviewInput({ authorName: 'A', rating: 5 }).ok, false);
  assert.equal(validateReviewInput({ authorName: 'أمين', rating: 6 }).ok, false);
  assert.equal(validateReviewInput({ authorName: 'أمين', rating: 0 }).ok, false);
  const valid = validateReviewInput({ authorName: '  سارة م. ', rating: 4.6, comment: ' ممتاز جداً ' });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.authorName, 'سارة م.');
    assert.equal(valid.rating, 5);
    assert.equal(valid.comment, 'ممتاز جداً');
  }
});

test('sanitizeAiMessages filters undefined, null, and malformed entries safely', () => {
  const dirty = [
    undefined,
    null,
    {},
    { id: '1', role: 'unknown', content: 'x' },
    { id: '2', role: 'user', content: '   ' },
    {
      id: '3',
      role: 'user',
      content: 'مرحبا',
      actions: [undefined, { label: '', ok: true }, { tool: 'list_orders', label: 'الطلبات', ok: true }],
    },
    { id: '4', role: 'assistant', content: 'أهلاً بك' },
  ];
  const clean = sanitizeAiMessages(dirty);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].role, 'user');
  assert.equal(clean[0].actions?.length, 1);
  assert.equal(clean[1].role, 'assistant');
});

test('parseGeminiErrorMessage extracts raw JSON 503 UNAVAILABLE into friendly localized error', () => {
  const raw503 =
    '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}';
  const arRes = parseGeminiErrorMessage(raw503, 503, 'ar');
  assert.equal(arRes.status, 503);
  assert.match(arRes.message, /ضغطًا مؤقتًا/);
  const frRes = parseGeminiErrorMessage(raw503, 503, 'fr');
  assert.match(frRes.message, /forte affluence/);
});

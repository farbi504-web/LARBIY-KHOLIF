import type { ProductReview, ProductReviewsData } from './types.ts';

export function computeReviewStats(
  reviews: Array<Pick<ProductReview, 'rating'>>,
): Pick<ProductReviewsData, 'averageRating' | 'totalReviews' | 'distribution'> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;

  for (const r of reviews) {
    const num = Number(r?.rating);
    if (!Number.isFinite(num)) continue;
    const clamped = Math.max(1, Math.min(5, Math.round(num)));
    distribution[clamped] = (distribution[clamped] || 0) + 1;
    sum += clamped;
    count += 1;
  }

  const averageRating = count > 0 ? Number((sum / count).toFixed(1)) : 0;
  return {
    averageRating,
    totalReviews: count,
    distribution,
  };
}

export function validateReviewInput(input: {
  authorName?: unknown;
  rating?: unknown;
  comment?: unknown;
}):
  | { ok: true; authorName: string; rating: number; comment: string }
  | { ok: false; error: string } {
  const authorName = String(input.authorName ?? '').trim().slice(0, 80);
  const rating = Number(input.rating);
  const comment = String(input.comment ?? '').trim().slice(0, 600);

  if (authorName.length < 2) {
    return { ok: false, error: 'Author name is required (at least 2 characters)' };
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Rating must be between 1 and 5' };
  }

  return {
    ok: true,
    authorName,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    comment,
  };
}

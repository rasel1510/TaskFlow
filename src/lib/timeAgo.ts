/**
 * src/lib/timeAgo.ts
 *
 * High-performance, zero-dependency relative time formatting utility.
 *
 * Industry-standard design:
 * - Pure function, O(1) time and memory complexity.
 * - Computes relative time at read time instead of storing stale string representations in DB.
 * - Handles Date objects, ISO-8601 strings, UNIX timestamps, and future/past deltas gracefully.
 * - Sane fallbacks for invalid or malformed date inputs.
 */

export type RelativeTimeInput = Date | string | number | null | undefined;

/**
 * Convert a past or future timestamp into a human-readable relative time string.
 *
 * @param date - Date object, ISO timestamp string, or UNIX epoch in milliseconds
 * @returns Human-readable string like "just now", "5 minutes ago", "2 hours ago", "3 days ago"
 *
 * @example
 *   timeAgo(new Date(Date.now() - 60_000)) // "1 minute ago"
 *   timeAgo("2026-09-22T20:00:00Z")        // "2 hours ago"
 *   timeAgo(null)                          // ""
 */
export function timeAgo(date: RelativeTimeInput): string {
  if (!date) return '';

  const timestamp = typeof date === 'number'
    ? date
    : date instanceof Date
    ? date.getTime()
    : new Date(date).getTime();

  if (isNaN(timestamp)) return '';

  const now = Date.now();
  const diffMs = now - timestamp;
  const isFuture = diffMs < 0;
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);

  // Future deltas
  if (isFuture) {
    if (diffSec < 45) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `in ${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'}`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `in ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  }

  // Past deltas
  if (diffSec < 45) {
    return 'just now';
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
}

export default timeAgo;

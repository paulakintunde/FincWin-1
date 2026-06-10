/**
 * Persistent rate limiting via Upstash Redis REST API.
 * Uses fetch directly — no npm package required.
 *
 * Required Vercel env vars:
 *   UPSTASH_REDIS_REST_URL   — e.g. https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — the REST token from the Upstash console
 *
 * Fails OPEN (allows the request) if Redis is unreachable, so a Redis outage
 * does not take down the API. Rate limiting is best-effort for availability.
 */

/**
 * Check whether `ip` is within the allowed rate for `endpoint`.
 *
 * @param {string} ip        - client IP address
 * @param {string} endpoint  - short name used to namespace the Redis key, e.g. 'activate'
 * @param {object} [opts]
 * @param {number} [opts.limit=10]    - max requests per window
 * @param {number} [opts.windowSecs=60] - sliding window in seconds
 * @returns {Promise<boolean>} true = within limit (allow), false = over limit (block)
 */
export async function checkRateLimit(ip, endpoint, { limit = 10, windowSecs = 60 } = {}) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fall back to in-memory allowance if env vars are not configured yet.
  if (!url || !token) {
    return _fallback(ip, endpoint, limit, windowSecs);
  }

  const key = `rl:${endpoint}:${ip}`;

  try {
    // Pipeline: INCR the key, then EXPIRE it (NX = only set TTL if not already set).
    // This is atomic and avoids a race between INCR and EXPIRE on the first request.
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSecs), 'NX'],
      ]),
    });

    if (!res.ok) return true; // fail open on HTTP error

    const [[, count]] = await res.json();
    return count <= limit;
  } catch {
    return true; // fail open on network error
  }
}

// ── In-memory fallback (used when Upstash env vars are absent) ──────────────
const _fallbackMap = new Map();

function _fallback(ip, endpoint, limit, windowSecs) {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const entry = _fallbackMap.get(key) || { count: 0, resetAt: now + windowSecs * 1000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowSecs * 1000; }
  entry.count++;
  _fallbackMap.set(key, entry);
  return entry.count <= limit;
}

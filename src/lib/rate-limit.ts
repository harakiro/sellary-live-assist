import { NextRequest, NextResponse } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

// Persist across Next.js HMR reloads in dev
const g = globalThis as unknown as {
  __rateLimitStore?: Map<string, RateLimitEntry>;
  __rateLimitCleanup?: NodeJS.Timeout;
};

if (!g.__rateLimitStore) {
  g.__rateLimitStore = new Map();

  // Clean up expired entries every 60 seconds
  g.__rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of g.__rateLimitStore!) {
      if (now >= entry.resetAt) {
        g.__rateLimitStore!.delete(key);
      }
    }
  }, 60_000);
}

const store = g.__rateLimitStore;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function check(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, limit: options.maxRequests, remaining: options.maxRequests - 1, resetAt: now + options.windowMs };
  }

  entry.count++;
  if (entry.count > options.maxRequests) {
    return { success: false, limit: options.maxRequests, remaining: 0, resetAt: entry.resetAt };
  }

  return { success: true, limit: options.maxRequests, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Create a rate limiter for a specific endpoint.
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export function rateLimit(req: NextRequest, endpoint: string, options: RateLimitOptions): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${endpoint}:${ip}`;
  const result = check(key, options);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}

/**
 * Add rate limit headers to a successful response.
 */
export function withRateLimitHeaders(res: NextResponse, req: NextRequest, endpoint: string, options: RateLimitOptions): NextResponse {
  const ip = getClientIp(req);
  const key = `${endpoint}:${ip}`;
  const entry = store.get(key);

  if (entry) {
    res.headers.set('X-RateLimit-Limit', String(options.maxRequests));
    res.headers.set('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - entry.count)));
    res.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  }

  return res;
}

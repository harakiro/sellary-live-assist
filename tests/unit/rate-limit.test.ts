import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the rate limit logic directly by importing the module's internals.
// Since the module uses NextRequest/NextResponse, we mock them minimally.

// Create a minimal mock of NextRequest
function mockRequest(ip = '127.0.0.1'): any {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return ip;
        return null;
      },
    },
  };
}

describe('rateLimit', () => {
  // Reset module between tests to clear the in-memory store
  let rateLimit: typeof import('@/lib/rate-limit').rateLimit;

  beforeEach(async () => {
    // Clear the global store between tests
    const g = globalThis as any;
    if (g.__rateLimitStore) {
      g.__rateLimitStore.clear();
    }
    const mod = await import('@/lib/rate-limit');
    rateLimit = mod.rateLimit;
  });

  it('should allow requests within the limit', () => {
    const req = mockRequest();
    const options = { windowMs: 60_000, maxRequests: 3 };

    expect(rateLimit(req, 'test', options)).toBeNull();
    expect(rateLimit(req, 'test', options)).toBeNull();
    expect(rateLimit(req, 'test', options)).toBeNull();
  });

  it('should block requests exceeding the limit', () => {
    const req = mockRequest();
    const options = { windowMs: 60_000, maxRequests: 2 };

    expect(rateLimit(req, 'test:block', options)).toBeNull();
    expect(rateLimit(req, 'test:block', options)).toBeNull();
    // Third request should be blocked
    const result = rateLimit(req, 'test:block', options);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it('should track different IPs separately', () => {
    const req1 = mockRequest('1.1.1.1');
    const req2 = mockRequest('2.2.2.2');
    const options = { windowMs: 60_000, maxRequests: 1 };

    expect(rateLimit(req1, 'test:ip', options)).toBeNull();
    expect(rateLimit(req2, 'test:ip', options)).toBeNull();
    // Both IPs used their one request — next ones should be blocked
    expect(rateLimit(req1, 'test:ip', options)).not.toBeNull();
    expect(rateLimit(req2, 'test:ip', options)).not.toBeNull();
  });

  it('should track different endpoints separately', () => {
    const req = mockRequest();
    const options = { windowMs: 60_000, maxRequests: 1 };

    expect(rateLimit(req, 'endpoint-a', options)).toBeNull();
    expect(rateLimit(req, 'endpoint-b', options)).toBeNull();
    // Both endpoints used — next should block
    expect(rateLimit(req, 'endpoint-a', options)).not.toBeNull();
    expect(rateLimit(req, 'endpoint-b', options)).not.toBeNull();
  });

  it('should include Retry-After header when rate limited', () => {
    const req = mockRequest();
    const options = { windowMs: 60_000, maxRequests: 1 };

    rateLimit(req, 'test:headers', options);
    const result = rateLimit(req, 'test:headers', options);
    expect(result).not.toBeNull();
    expect(result?.headers.get('Retry-After')).toBeTruthy();
    expect(result?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

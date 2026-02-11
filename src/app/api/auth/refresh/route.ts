import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { refreshSchema } from '@/lib/validations/auth';
import { rateLimit } from '@/lib/rate-limit';

const REFRESH_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 30 };

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'auth:refresh', REFRESH_LIMIT);
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }

    const payload = await verifyRefreshToken(parsed.data.refreshToken);
    const tokenPayload = { userId: payload.userId, workspaceId: payload.workspaceId };

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    return NextResponse.json({
      data: { accessToken, refreshToken },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } },
      { status: 401 },
    );
  }
}

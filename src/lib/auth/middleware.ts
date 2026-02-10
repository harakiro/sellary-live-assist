import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type TokenPayload } from './jwt';

export type AuthenticatedRequest = NextRequest & {
  auth: TokenPayload;
};

type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } },
        { status: 401 },
      );
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyAccessToken(token);
      (req as AuthenticatedRequest).auth = payload;
      return handler(req as AuthenticatedRequest, context);
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 },
      );
    }
  };
}

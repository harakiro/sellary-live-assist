import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, workspaces } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { registerSchema } from '@/lib/validations/auth';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }

    const { email, password, name, workspaceName } = parsed.data;

    // Check if email already exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Email already registered' } },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    // Create workspace first, then user
    const [workspace] = await db
      .insert(workspaces)
      .values({
        ownerUserId: '00000000-0000-0000-0000-000000000000', // placeholder, updated below
        name: workspaceName,
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        workspaceId: workspace.id,
      })
      .returning();

    // Update workspace owner
    await db.update(workspaces).set({ ownerUserId: user.id }).where(eq(workspaces.id, workspace.id));

    const tokenPayload = { userId: user.id, workspaceId: workspace.id };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    return NextResponse.json(
      {
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          workspace: { id: workspace.id, name: workspace.name },
          accessToken,
          refreshToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } },
      { status: 500 },
    );
  }
}

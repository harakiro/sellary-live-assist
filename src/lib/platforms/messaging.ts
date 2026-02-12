import { db } from '@/lib/db';
import { shows, socialConnections, claims } from '@/lib/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { sendDirectMessage as sendFBDM, replyToComment } from '@/lib/platforms/facebook/api';
import { sendDirectMessage as sendIGDM } from '@/lib/platforms/instagram/api';

export async function sendCheckoutDM(params: {
  showId: string;
  buyerPlatformId: string;
  buyerHandle: string | null;
  checkoutUrl: string;
}): Promise<{ sent: boolean; prompted?: boolean; error?: string }> {
  const { showId, buyerPlatformId, buyerHandle, checkoutUrl } = params;

  const [show] = await db.select().from(shows).where(eq(shows.id, showId));
  if (!show) {
    return { sent: false, error: 'Show not found' };
  }

  if (!show.connectionId) {
    return { sent: false, error: 'No sales channel configured' };
  }

  if (!show.platform) {
    return { sent: false, error: 'Show has no platform set' };
  }

  const [connection] = await db
    .select()
    .from(socialConnections)
    .where(eq(socialConnections.id, show.connectionId));

  if (!connection) {
    return { sent: false, error: 'Sales channel connection not found' };
  }

  if (connection.status !== 'active') {
    return { sent: false, error: 'Sales channel connection is not active' };
  }

  let accessToken: string;
  try {
    accessToken = decrypt(connection.encryptedAccessToken);
  } catch {
    return { sent: false, error: 'Failed to decrypt access token' };
  }

  const name = buyerHandle || 'there';
  const message = `Hi ${name}! Your checkout link is ready: ${checkoutUrl}`;

  if (show.platform === 'facebook') {
    const result = await sendFBDM(
      accessToken,
      connection.externalAccountId,
      buyerPlatformId,
      message,
    );
    if (!result.ok) {
      // Comment-reply fallback when messaging window is closed
      if (result.code === 'OUTSIDE_WINDOW') {
        const [claim] = await db
          .select()
          .from(claims)
          .where(
            and(
              eq(claims.showId, showId),
              eq(claims.platformUserId, buyerPlatformId),
              eq(claims.claimStatus, 'winner'),
              isNotNull(claims.commentId),
            ),
          )
          .orderBy(desc(claims.createdAt))
          .limit(1);

        if (claim?.commentId) {
          const pageId = connection.externalAccountId;
          const handle = buyerHandle || 'there';
          const promptMessage = `Congrats ${handle}! Send us a DM to get your checkout link: https://m.me/${pageId}`;
          const reply = await replyToComment(accessToken, claim.commentId, promptMessage);
          if (reply) {
            return { sent: false, prompted: true };
          }
        }
      }
      return { sent: false, error: result.error };
    }
    return { sent: true };
  }

  if (show.platform === 'instagram') {
    const result = await sendIGDM(
      accessToken,
      connection.externalAccountId,
      buyerPlatformId,
      message,
    );
    if (!result.ok) {
      return { sent: false, error: result.error };
    }
    return { sent: true };
  }

  return { sent: false, error: `Unsupported platform: ${show.platform}` };
}

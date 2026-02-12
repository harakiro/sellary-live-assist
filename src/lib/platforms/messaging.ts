import { db } from '@/lib/db';
import { shows, socialConnections, claims, comments } from '@/lib/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { sendDirectMessage as sendFBDM, replyToComment } from '@/lib/platforms/facebook/api';
import { sendDirectMessage as sendIGDM } from '@/lib/platforms/instagram/api';

export function getShortCheckoutUrl(invoiceId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/pay/${invoiceId}`;
}

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
        console.log(`[FB DM] Outside window for ${buyerPlatformId}, attempting comment-reply fallback`);

        // Find the buyer's most recent comment on this show's live thread
        const [latestComment] = await db
          .select()
          .from(comments)
          .where(
            and(
              eq(comments.showId, showId),
              eq(comments.platformUserId, buyerPlatformId),
              isNotNull(comments.commentId),
            ),
          )
          .orderBy(desc(comments.receivedAt))
          .limit(1);

        const replyTarget = latestComment?.commentId;

        if (replyTarget) {
          const handle = buyerHandle || 'there';
          const promptMessage = `Hey ${handle}! Please send us a DM so we can get your checkout link to you!`;
          console.log(`[FB DM] Replying to comment ${replyTarget} for ${buyerPlatformId}`);
          const reply = await replyToComment(accessToken, replyTarget, promptMessage);
          if (reply) {
            console.log(`[FB DM] Comment reply sent successfully: ${reply.id}`);
            return { sent: false, prompted: true };
          }
          console.warn(`[FB DM] Comment reply failed for comment ${replyTarget}`);
        } else {
          console.warn(`[FB DM] No comments found for buyer ${buyerPlatformId} in show ${showId}`);
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

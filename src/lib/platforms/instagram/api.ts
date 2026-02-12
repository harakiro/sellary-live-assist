const META_GRAPH_API_BASE = 'https://graph.facebook.com';

function getGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || 'v22.0';
}

export type LiveMedia = {
  id: string;
  timestamp: string;
  mediaType: string;
};

/**
 * Get active live media for an Instagram user.
 * Note: This requires App Review approval for live_media edge.
 */
export async function getActiveLives(
  accessToken: string,
  igUserId: string,
): Promise<LiveMedia[]> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${igUserId}/live_media`;
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,timestamp,media_type',
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`IG live media fetch failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.data || []).map((m: Record<string, string>) => ({
    id: m.id,
    timestamp: m.timestamp,
    mediaType: m.media_type,
  }));
}

export type DMResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; code?: string };

/**
 * Send a direct message via Instagram Messaging API.
 */
export async function sendDirectMessage(
  accessToken: string,
  igUserId: string,
  recipientId: string,
  message: string,
): Promise<DMResult> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${igUserId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[IG DM] Failed to send to ${recipientId}:`, err);
      const fbError = err.error as { code?: number; message?: string } | undefined;

      if (fbError?.code === 10) {
        return {
          ok: false,
          error: 'Buyer hasn\'t messaged your account on Instagram yet. Instagram requires buyers to DM you first. Copy the link and share it another way.',
          code: 'OUTSIDE_WINDOW',
        };
      }

      return { ok: false, error: fbError?.message || 'Instagram API error' };
    }

    const data = await res.json();
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    console.error(`[IG DM] Error sending to ${recipientId}:`, err);
    return { ok: false, error: 'Network error sending message' };
  }
}

const META_GRAPH_API_BASE = 'https://graph.facebook.com';

function getGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || 'v22.0';
}

export type LiveVideo = {
  id: string;
  title: string;
  status: string;
  embedHtml?: string;
  permalink?: string;
};

/**
 * Get active live videos for a Facebook Page.
 */
export async function getActiveLives(
  pageAccessToken: string,
  pageId: string,
): Promise<LiveVideo[]> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${pageId}/live_videos`;
  const params = new URLSearchParams({
    access_token: pageAccessToken,
    broadcast_status: JSON.stringify(['LIVE']),
    fields: 'id,title,status,embed_html,permalink_url',
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB live videos fetch failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.data || []).map((v: Record<string, string>) => ({
    id: v.id,
    title: v.title || 'Untitled Live',
    status: v.status,
    embedHtml: v.embed_html,
    permalink: v.permalink_url,
  }));
}

/**
 * Get a specific live video by ID.
 */
export async function getLiveVideoById(
  accessToken: string,
  liveVideoId: string,
): Promise<LiveVideo> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${liveVideoId}`;
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,title,status,embed_html,permalink_url',
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB live video fetch failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    title: data.title || 'Untitled Live',
    status: data.status,
    embedHtml: data.embed_html,
    permalink: data.permalink_url,
  };
}

type CommentPage = {
  comments: FBComment[];
  afterCursor: string | null;
};

export type FBComment = {
  id: string;
  message: string;
  from?: { id: string; name: string };
  created_time: string;
  parent?: { id: string };
};

/**
 * Fetch comments for a live video, using cursor-based pagination.
 */
export async function getLiveComments(
  accessToken: string,
  liveVideoId: string,
  afterCursor?: string,
): Promise<CommentPage> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${liveVideoId}/comments`;
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,message,from,created_time,parent',
    filter: 'stream',
    order: 'chronological',
    limit: '100',
  });

  if (afterCursor) {
    params.set('after', afterCursor);
  }

  const res = await fetch(`${url}?${params}`);

  if (res.status === 429) {
    // Rate limited
    throw new RateLimitError('Facebook Graph API rate limit reached');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB comments fetch failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    comments: data.data || [],
    afterCursor: data.paging?.cursors?.after || null,
  };
}

/**
 * Reply to a comment as the Page.
 * Returns the new comment ID on success, null on failure.
 */
export async function replyToComment(
  pageAccessToken: string,
  commentId: string,
  message: string,
): Promise<{ id: string } | null> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${commentId}/comments`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: pageAccessToken, message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[FB Reply] Failed to reply to ${commentId}:`, err);
      return null;
    }

    const data = await res.json();
    return { id: data.id };
  } catch (err) {
    console.error(`[FB Reply] Error replying to ${commentId}:`, err);
    return null;
  }
}

export type DMResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; code?: string };

/**
 * Send a direct message via Facebook Messenger (Page-scoped).
 * Uses POST_PURCHASE_UPDATE tag to allow messaging outside the 24h window.
 */
export async function sendDirectMessage(
  pageAccessToken: string,
  pageId: string,
  recipientId: string,
  message: string,
): Promise<DMResult> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/${pageId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: pageAccessToken,
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'MESSAGE_TAG',
        tag: 'POST_PURCHASE_UPDATE',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[FB DM] Failed to send to ${recipientId}:`, err);
      return { ok: false, ...parseFBMessagingError(err) };
    }

    const data = await res.json();
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    console.error(`[FB DM] Error sending to ${recipientId}:`, err);
    return { ok: false, error: 'Network error sending message' };
  }
}

function parseFBMessagingError(err: Record<string, unknown>): { error: string; code?: string } {
  const fbError = err.error as { code?: number; error_subcode?: number; message?: string } | undefined;
  if (!fbError) return { error: 'Unknown Facebook API error' };

  // Outside messaging window — 24h since buyer's last message to the Page
  if (fbError.code === 10 && fbError.error_subcode === 2018278) {
    return {
      error: 'Messaging window closed — it\'s been more than 24 hours since this buyer messaged your Page. Ask the buyer to send your Page a message, then try again.',
      code: 'OUTSIDE_WINDOW',
    };
  }

  // Generic outside-window variant
  if (fbError.code === 10) {
    return {
      error: 'Facebook messaging window is closed for this buyer. They need to message your Page first, then try again within 24 hours.',
      code: 'OUTSIDE_WINDOW',
    };
  }

  // Permission not granted
  if (fbError.code === 230) {
    return {
      error: 'Missing pages_messaging permission. Reconnect your Facebook Page in Sales Channels.',
      code: 'MISSING_PERMISSION',
    };
  }

  // Rate limited
  if (fbError.code === 4) {
    return {
      error: 'Facebook rate limit reached. Wait a moment and try again.',
      code: 'RATE_LIMITED',
    };
  }

  return { error: fbError.message || 'Facebook API error' };
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

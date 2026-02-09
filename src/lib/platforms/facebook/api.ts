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
  from: { id: string; name: string };
  created_time: string;
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
    fields: 'id,message,from,created_time',
    order: 'reverse_chronological',
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

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

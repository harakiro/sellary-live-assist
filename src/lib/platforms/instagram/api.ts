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

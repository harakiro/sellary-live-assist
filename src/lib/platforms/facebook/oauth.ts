const META_GRAPH_API_BASE = 'https://graph.facebook.com';

function getGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || 'v22.0';
}

function getAppCredentials() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID and META_APP_SECRET must be set');
  return { appId, appSecret };
}

/**
 * Build the Facebook OAuth authorization URL.
 * Requests pages_show_list, pages_read_engagement, and pages_manage_metadata
 * for reading live video comments.
 */
export function buildFBAuthUrl(redirectUri: string, state: string): string {
  const { appId } = getAppCredentials();
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_read_user_content',
  ].join(',');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: 'code',
  });

  return `https://www.facebook.com/${getGraphVersion()}/dialog/oauth?${params}`;
}

type TokenResponse = {
  accessToken: string;
  expiresIn: number;
};

/**
 * Exchange an authorization code for a short-lived access token.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { appId, appSecret } = getAppCredentials();
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/oauth/access_token`;

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB token exchange failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Exchange a short-lived token for a long-lived token (~60 days).
 */
export async function exchangeForLongLivedToken(
  shortToken: string,
): Promise<TokenResponse> {
  const { appId, appSecret } = getAppCredentials();
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/oauth/access_token`;

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB long-lived token exchange failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

export type FBPage = {
  id: string;
  name: string;
  accessToken: string;
};

/**
 * Get all pages the user manages, including per-page access tokens.
 */
export async function getConnectedPages(userAccessToken: string): Promise<FBPage[]> {
  const url = `${META_GRAPH_API_BASE}/${getGraphVersion()}/me/accounts`;

  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields: 'id,name,access_token',
  });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`FB pages fetch failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.data || []).map((page: { id: string; name: string; access_token: string }) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
  }));
}

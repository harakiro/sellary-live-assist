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
 * Build the Instagram OAuth authorization URL.
 * Uses Facebook Login to request IG-related permissions.
 */
export function buildIGAuthUrl(redirectUri: string, state: string): string {
  const { appId } = getAppCredentials();
  const scopes = [
    'instagram_basic',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_read_engagement',
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

/**
 * Exchange auth code for an access token (same as FB exchange).
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresIn: number }> {
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
    throw new Error(`IG token exchange failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

export type IGAccount = {
  id: string;
  username: string;
  name: string;
  pageId: string;
  pageName: string;
};

/**
 * Get Instagram Business/Creator accounts linked to the user's FB Pages.
 */
export async function getConnectedIGAccounts(
  userAccessToken: string,
): Promise<IGAccount[]> {
  // First, get the user's pages
  const pagesUrl = `${META_GRAPH_API_BASE}/${getGraphVersion()}/me/accounts`;
  const pagesParams = new URLSearchParams({
    access_token: userAccessToken,
    fields: 'id,name,instagram_business_account{id,username,name}',
  });

  const pagesRes = await fetch(`${pagesUrl}?${pagesParams}`);
  if (!pagesRes.ok) {
    const err = await pagesRes.json().catch(() => ({}));
    throw new Error(`IG accounts fetch failed: ${JSON.stringify(err)}`);
  }

  const pagesData = await pagesRes.json();
  const accounts: IGAccount[] = [];

  for (const page of pagesData.data || []) {
    if (page.instagram_business_account) {
      accounts.push({
        id: page.instagram_business_account.id,
        username: page.instagram_business_account.username || '',
        name: page.instagram_business_account.name || page.name,
        pageId: page.id,
        pageName: page.name,
      });
    }
  }

  return accounts;
}

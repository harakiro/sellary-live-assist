import { replyToComment } from './api';
import { decrypt } from '@/lib/encryption';

export type ReplyCase = 'winner' | 'duplicate' | 'waitlist';

export type AutoReplyContext = {
  commentId: string;
  userDisplayName: string;
  itemNumber: string;
  encryptedAccessToken: string;
  replyCase: ReplyCase;
  templates: string[];
};

export function interpolateTemplate(
  template: string,
  vars: { user: string; item: string },
): string {
  return template
    .replace(/\{\{user\}\}/g, vars.user)
    .replace(/\{\{item\}\}/g, vars.item);
}

export function sendAutoReply(ctx: AutoReplyContext): void {
  if (ctx.templates.length === 0) return;

  const template = ctx.templates[Math.floor(Math.random() * ctx.templates.length)];
  const message = interpolateTemplate(template, {
    user: ctx.userDisplayName,
    item: ctx.itemNumber,
  });

  let accessToken: string;
  try {
    accessToken = decrypt(ctx.encryptedAccessToken);
  } catch (err) {
    console.error('[AutoReply] Failed to decrypt access token:', err);
    return;
  }

  replyToComment(accessToken, ctx.commentId, message).catch(() => {});
}

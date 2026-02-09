/**
 * Common interface for comments from any platform (Facebook or Instagram).
 * Platform adapters normalize raw API responses into this shape
 * before passing to the claim engine.
 */
export type CommentEvent = {
  platform: 'facebook' | 'instagram';
  liveId: string;
  commentId: string;
  userId: string;
  userHandle: string;
  userDisplayName: string;
  text: string;
  timestamp: Date;
};

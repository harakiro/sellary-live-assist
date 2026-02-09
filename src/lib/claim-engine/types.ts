export type ClaimIntent = {
  type: 'claim';
  itemNumber: string;
  rawText: string;
};

export type PassIntent = {
  type: 'pass';
  itemNumber: string;
  rawText: string;
};

export type ParseResult = ClaimIntent | PassIntent | null;

export type CommentInfo = {
  platform: 'facebook' | 'instagram';
  liveId: string;
  commentId: string;
  platformUserId: string;
  userHandle: string;
  userDisplayName: string;
  rawText: string;
  timestamp: Date;
};

export type ClaimResult =
  | { status: 'winner'; claimId: string; itemNumber: string }
  | { status: 'waitlist'; claimId: string; itemNumber: string; position: number }
  | { status: 'item_not_found'; itemNumber: string }
  | { status: 'duplicate'; itemNumber: string }
  | { status: 'duplicate_user'; itemNumber: string }
  | { status: 'show_not_active'; itemNumber: string };

export type PassResult =
  | { status: 'released'; claimId: string; promoted?: { claimId: string; userHandle: string } }
  | { status: 'no_active_claim' }
  | { status: 'item_not_found' };

export type ReleaseResult =
  | { status: 'released'; promoted?: { claimId: string; userHandle: string } }
  | { status: 'claim_not_found' }
  | { status: 'already_released' };

export type AwardResult =
  | { status: 'awarded'; claimId: string }
  | { status: 'item_not_found' }
  | { status: 'no_quantity_available' };

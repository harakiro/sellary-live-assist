export type ClaimCreatedEvent = {
  type: 'claim.created';
  data: {
    claimId: string;
    showId: string;
    itemNumber: string;
    userHandle: string;
    claimStatus: 'winner' | 'waitlist';
    waitlistPosition?: number;
    timestamp: string;
  };
};

export type ClaimReleasedEvent = {
  type: 'claim.released';
  data: {
    claimId: string;
    showId: string;
    itemNumber: string;
    userHandle: string;
    promoted?: {
      claimId: string;
      userHandle: string;
    };
    timestamp: string;
  };
};

export type ItemUpdatedEvent = {
  type: 'item.updated';
  data: {
    itemId: string;
    showId: string;
    itemNumber: string;
    claimedCount: number;
    totalQuantity: number;
    status: string;
  };
};

export type SessionStatusEvent = {
  type: 'session.status';
  data: {
    showId: string;
    status: string;
    timestamp: string;
  };
};

export type CommentReceivedEvent = {
  type: 'comment.received';
  data: {
    showId: string;
    commentId?: string;
    userHandle: string;
    text: string;
    parsed: boolean;
    timestamp: string;
  };
};

export type ErrorEvent = {
  type: 'error';
  data: {
    code: string;
    message: string;
  };
};

export type RealtimeEvent =
  | ClaimCreatedEvent
  | ClaimReleasedEvent
  | ItemUpdatedEvent
  | SessionStatusEvent
  | CommentReceivedEvent
  | ErrorEvent;

// Real-time event types emitted by the WebSocket server

export type ClaimCreatedEvent = {
  type: 'claim.created';
  data: {
    showId: string;
    claimId: string;
    itemNumber: string;
    itemTitle?: string;
    userHandle: string;
    claimStatus: 'winner' | 'waitlist';
    waitlistPosition?: number;
    timestamp: string;
  };
};

export type ClaimReleasedEvent = {
  type: 'claim.released';
  data: {
    showId: string;
    claimId: string;
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
    showId: string;
    itemNumber: string;
    claimedCount: number;
    totalQuantity: number;
    status: string;
    timestamp: string;
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
    isReply?: boolean;
    parentCommentId?: string;
    timestamp: string;
  };
};

export type UnmatchedResolvedEvent = {
  type: 'unmatched.resolved';
  data: {
    showId: string;
    itemNumber: string;
    resolved: number;
    winners: string[];
    waitlisted: string[];
    timestamp: string;
  };
};

export type InvoiceUpdatedEvent = {
  type: 'invoice.updated';
  data: {
    invoiceId: string;
    showId: string;
    buyerHandle: string | null;
    status: string;
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
  | UnmatchedResolvedEvent
  | InvoiceUpdatedEvent
  | ErrorEvent;

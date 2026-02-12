export type Cart = {
  id: string;
  showId: string;
  showName: string;
  showPlatform: 'facebook' | 'instagram' | null;
  buyerHandle: string | null;
  buyerPlatformId: string | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  lineItems: Array<{
    itemNumber: string;
    title: string;
    quantity: number;
    unitAmountCents: number;
  }> | null;
  externalUrl: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type CartCounts = {
  all: number;
  sent: number;
  paid: number;
  void: number;
  error: number;
};

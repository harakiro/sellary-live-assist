export type IntegrationProvider = 'stripe' | 'shopify' | 'square' | 'medusajs';

export type IntegrationAdapter = {
  provider: IntegrationProvider;
  displayName: string;
  description: string;

  validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; error?: string }>;
  testConnection(credentialsEnc: string): Promise<{ ok: boolean; error?: string }>;

  createInvoice?(params: InvoiceParams): Promise<InvoiceResult>;
  getInvoiceStatus?(externalId: string, credentialsEnc: string): Promise<InvoiceStatusResult>;
};

export type InvoiceParams = {
  credentialsEnc: string;
  showId: string;
  buyerHandle: string;
  buyerPlatformId: string;
  buyerEmail?: string;
  showName: string;
  lineItems: InvoiceLineItem[];
  currency?: string;
  memo?: string;
};

export type InvoiceLineItem = {
  itemNumber: string;
  title: string;
  quantity: number;
  unitAmountCents: number;
};

export type InvoiceResult = {
  externalId: string;
  externalUrl: string;
  amountCents: number;
  currency: string;
  status: 'draft' | 'sent';
};

export type InvoiceStatusResult = {
  status: 'draft' | 'sent' | 'paid' | 'void' | 'error';
  amountCents: number;
  paidAt?: string;
};

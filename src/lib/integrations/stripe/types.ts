export type StripeCredentials = {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  webhookEndpointId?: string;
};

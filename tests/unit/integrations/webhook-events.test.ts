import { describe, it, expect } from 'vitest';
import type { InvoiceUpdatedEvent, RealtimeEvent } from '@/lib/realtime/events';

describe('Invoice Realtime Events', () => {
  it('should create a valid InvoiceUpdatedEvent', () => {
    const event: InvoiceUpdatedEvent = {
      type: 'invoice.updated',
      data: {
        invoiceId: '123',
        showId: '456',
        buyerHandle: 'test_buyer',
        status: 'paid',
        timestamp: new Date().toISOString(),
      },
    };

    expect(event.type).toBe('invoice.updated');
    expect(event.data.invoiceId).toBe('123');
    expect(event.data.status).toBe('paid');
  });

  it('should allow null buyerHandle', () => {
    const event: InvoiceUpdatedEvent = {
      type: 'invoice.updated',
      data: {
        invoiceId: '123',
        showId: '456',
        buyerHandle: null,
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    };

    expect(event.data.buyerHandle).toBeNull();
  });

  it('should be assignable to RealtimeEvent', () => {
    const event: RealtimeEvent = {
      type: 'invoice.updated',
      data: {
        invoiceId: '123',
        showId: '456',
        buyerHandle: 'buyer',
        status: 'paid',
        timestamp: new Date().toISOString(),
      },
    };

    expect(event.type).toBe('invoice.updated');
  });

  it('should accept all valid invoice statuses', () => {
    const statuses = ['draft', 'sent', 'paid', 'void', 'error'];
    for (const status of statuses) {
      const event: InvoiceUpdatedEvent = {
        type: 'invoice.updated',
        data: {
          invoiceId: 'inv-1',
          showId: 'show-1',
          buyerHandle: 'buyer',
          status,
          timestamp: new Date().toISOString(),
        },
      };
      expect(event.data.status).toBe(status);
    }
  });
});

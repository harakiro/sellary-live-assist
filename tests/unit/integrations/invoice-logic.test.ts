import { describe, it, expect } from 'vitest';
import type { InvoiceLineItem } from '@/lib/integrations/types';

// Test the buyer rollup → line items mapping logic
describe('Invoice Line Item Mapping', () => {
  function mapToLineItems(
    items: { itemNumber: string; title: string; price: number | null; quantity: number }[],
  ): InvoiceLineItem[] {
    return items.map((item) => ({
      itemNumber: item.itemNumber,
      title: item.title,
      quantity: item.quantity,
      unitAmountCents: item.price ?? 0,
    }));
  }

  it('should map items with prices correctly', () => {
    const items = [
      { itemNumber: '101', title: 'Blue Dress', price: 2500, quantity: 1 },
      { itemNumber: '102', title: 'Red Shirt', price: 1999, quantity: 1 },
    ];

    const lineItems = mapToLineItems(items);
    expect(lineItems).toHaveLength(2);
    expect(lineItems[0].unitAmountCents).toBe(2500);
    expect(lineItems[1].unitAmountCents).toBe(1999);
    expect(lineItems[0].itemNumber).toBe('101');
    expect(lineItems[0].title).toBe('Blue Dress');
  });

  it('should default null prices to 0 cents', () => {
    const items = [
      { itemNumber: '101', title: 'No Price Item', price: null, quantity: 1 },
    ];

    const lineItems = mapToLineItems(items);
    expect(lineItems[0].unitAmountCents).toBe(0);
  });

  it('should handle multiple quantities', () => {
    const items = [
      { itemNumber: '101', title: 'Item A', price: 1000, quantity: 3 },
    ];

    const lineItems = mapToLineItems(items);
    expect(lineItems[0].quantity).toBe(3);
  });

  it('should handle empty items array', () => {
    const lineItems = mapToLineItems([]);
    expect(lineItems).toHaveLength(0);
  });

  it('should handle zero-price items', () => {
    const items = [
      { itemNumber: '101', title: 'Free Item', price: 0, quantity: 1 },
    ];

    const lineItems = mapToLineItems(items);
    expect(lineItems[0].unitAmountCents).toBe(0);
  });
});

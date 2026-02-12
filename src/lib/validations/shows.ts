import { z } from 'zod';

export const createShowSchema = z.object({
  name: z.string().min(1, 'Show name is required').max(255),
  platform: z.enum(['facebook', 'instagram']).optional(),
  connectionId: z.string().uuid().optional(),
  claimWord: z.string().min(1).max(50).default('sold'),
  passWord: z.string().min(1).max(50).default('pass'),
  autoNumberEnabled: z.boolean().default(false),
  autoNumberStart: z.number().int().min(0).default(1),
});

export const updateShowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  platform: z.enum(['facebook', 'instagram']).optional(),
  connectionId: z.string().uuid().optional(),
  liveId: z.string().max(255).optional(),
  liveUrl: z.string().url().optional(),
  claimWord: z.string().min(1).max(50).optional(),
  passWord: z.string().min(1).max(50).optional(),
  autoNumberEnabled: z.boolean().optional(),
  autoNumberStart: z.number().int().min(0).optional(),
});

export const addItemSchema = z.object({
  itemNumber: z.string().min(1, 'Item number is required').max(50),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional(),
  totalQuantity: z.number().int().min(1).max(30).default(1),
  price: z.number().int().min(0).nullable().optional(),
});

export const addItemsSchema = z.object({
  items: z.array(addItemSchema).min(1, 'At least one item required'),
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  totalQuantity: z.number().int().min(1).max(30).optional(),
  price: z.number().int().min(0).nullable().optional(),
});

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;

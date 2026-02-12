import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { hashPassword } from '../auth/password';

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle(pool, { schema });

  console.log('Seeding database...');

  // Create workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: 'Demo Workspace',
      ownerUserId: '00000000-0000-0000-0000-000000000000', // placeholder, updated below
    })
    .returning();
  console.log('Created workspace:', workspace.id);

  // Create user
  const passwordHash = await hashPassword('password123');
  const [user] = await db
    .insert(schema.users)
    .values({
      email: 'demo@sellary.com',
      passwordHash,
      name: 'Demo User',
      workspaceId: workspace.id,
    })
    .returning();
  console.log('Created user:', user.email);

  // Update workspace owner
  const { eq } = await import('drizzle-orm');
  await db
    .update(schema.workspaces)
    .set({ ownerUserId: user.id })
    .where(eq(schema.workspaces.id, workspace.id));

  // Create a draft show with items
  const [show] = await db
    .insert(schema.shows)
    .values({
      workspaceId: workspace.id,
      name: 'Demo Live Sale',
      status: 'draft',
      claimWord: 'sold',
      passWord: 'pass',
    })
    .returning();
  console.log('Created show:', show.name);

  // Create show items
  const items = [
    { itemNumber: '101', title: 'Vintage Denim Jacket', totalQuantity: 2 },
    { itemNumber: '102', title: 'Floral Summer Dress', totalQuantity: 1 },
    { itemNumber: '103', title: 'Leather Crossbody Bag', totalQuantity: 3 },
    { itemNumber: '104', title: 'Silk Scarf - Blue', totalQuantity: 5 },
    { itemNumber: '105', title: 'High-Waist Jeans', totalQuantity: 2 },
  ];

  await db.insert(schema.showItems).values(
    items.map((item) => ({
      showId: show.id,
      ...item,
    })),
  );
  console.log(`Created ${items.length} show items`);

  console.log('\nSeed complete!');
  console.log('Login credentials: demo@sellary.com / password123');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

import pg from 'pg';
import dotenv from 'dotenv';
import { loadDB, saveDB, generateUUID } from './store';

dotenv.config();

let isPrismaConnected = false;
let prismaInstance: any = null;
let prismaInitPromise: Promise<void> | null = null;

async function initPrismaConnection() {
  if (prismaInitPromise) return prismaInitPromise;

  prismaInitPromise = (async () => {
    const rawDbUrl = (process.env.DATABASE_URL || '').trim();
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (!rawDbUrl) {
      console.log('[Prisma] DATABASE_URL process.env variable is not set. Using synchronized store fallback.');
      isPrismaConnected = false;
      return;
    }

    if (isProd && (rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1'))) {
      console.log('[Prisma] Production runtime detected with localhost DATABASE_URL. Skipping PostgreSQL initialization.');
      isPrismaConnected = false;
      return;
    }

    try {
      console.log('[Prisma] Attempting PostgreSQL connection via Prisma/pg...');
      const prismaModule = await import('@prisma/client').catch((err) => {
        console.warn('[Prisma] Dynamic import @prisma/client failed:', err?.message || err);
        return null;
      });
      const adapterModule = await import('@prisma/adapter-pg').catch((err) => {
        console.warn('[Prisma] Dynamic import @prisma/adapter-pg failed:', err?.message || err);
        return null;
      });

      if (prismaModule && ('PrismaClient' in prismaModule) && adapterModule && ('PrismaPg' in adapterModule)) {
        const PrismaClientClass = (prismaModule as any).PrismaClient;
        const PrismaPgClass = (adapterModule as any).PrismaPg;
        const pool = new pg.Pool({
          connectionString: rawDbUrl,
          connectionTimeoutMillis: 1500,
        });

        pool.on('error', (err) => {
          console.warn('[Prisma] Idle PG Pool error:', err?.message || err);
          isPrismaConnected = false;
        });

        // Test connectivity first with a lightweight SELECT 1 query
        await pool.query('SELECT 1');

        const adapter = new PrismaPgClass(pool);
        prismaInstance = new PrismaClientClass({ adapter });
        await prismaInstance.$connect();
        isPrismaConnected = true;
        console.log('[Prisma] Connected successfully to PostgreSQL database.');

        // Trigger one-time background migration from JSON to Postgres if DB connected
        import('../../scripts/migrate-json-to-postgres')
          .then((m) => m.migrateJsonToPostgres())
          .catch((err) => console.warn('[Prisma] Background JSON migration error:', err));
      } else {
        console.warn('[Prisma] Required Prisma packages not available at runtime. Using store fallback.');
        isPrismaConnected = false;
      }
    } catch (err: any) {
      isPrismaConnected = false;
      prismaInstance = null;
      console.log('[Prisma] PostgreSQL database unreachable at DATABASE_URL:', err?.message || 'Connection failed', '. Using synchronized JSON store fallback.');
    }
  })();

  return prismaInitPromise;
}

export async function ensurePrismaInitialized() {
  try {
    await initPrismaConnection();
  } catch (err) {
    console.warn('[Prisma] ensurePrismaInitialized caught error safely:', err);
    isPrismaConnected = false;
  }
}

// Export initialization helper to be called lazily inside request handlers
export function getPrisma() {
  return prismaInstance;
}

export function isDbConnected() {
  return isPrismaConnected;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!prismaInstance) return undefined;
      const val = (prismaInstance as any)[prop];
      return typeof val === 'function' ? val.bind(prismaInstance) : val;
    },
  }
) as any;

export async function getUserCount(): Promise<number> {
  let prismaCount = 0;
  try {
    await ensurePrismaInitialized();
    if (prismaInstance && isPrismaConnected) {
      try {
        prismaCount = await prismaInstance.user.count({
          where: { deletedAt: null },
        });
      } catch (e: any) {
        isPrismaConnected = false;
        console.warn('[Prisma] PostgreSQL user count query failed:', e?.message || e);
      }
    }
  } catch (err: any) {
    console.warn('[PrismaService] Error checking Prisma user count:', err?.message || err);
  }

  try {
    const db = loadDB();
    const jsonCount = (db.users || []).length;
    return Math.max(prismaCount, jsonCount);
  } catch {
    return prismaCount;
  }
}

export async function findUserByEmailOrUsername(identifier: string) {
  try {
    await ensurePrismaInitialized();
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;

    // First try PostgreSQL database if Prisma is initialized and connected
    if (prismaInstance && isPrismaConnected) {
      try {
        const dbUser = await prismaInstance.user.findFirst({
          where: {
            OR: [{ email: cleanId }, { username: cleanId }],
            deletedAt: null,
            isActive: true,
          },
        });
        if (dbUser) {
          return {
            id: dbUser.id,
            name: dbUser.name,
            username: dbUser.username || dbUser.email,
            email: dbUser.email,
            passwordHash: dbUser.passwordHash,
            role: dbUser.role as any,
            isActive: dbUser.isActive,
            createdAt: dbUser.createdAt ? dbUser.createdAt.toISOString() : new Date().toISOString(),
          };
        }
      } catch (e: any) {
        isPrismaConnected = false;
        console.warn('[Prisma] PostgreSQL search query failed:', e?.message || e);
      }
    }

    // Fall back to synchronized store
    const db = loadDB();
    const foundUser = (db.users || []).find(
      (u) =>
        (u.username?.toLowerCase() === cleanId ||
          u.email?.toLowerCase() === cleanId ||
          u.name?.toLowerCase() === cleanId ||
          u.id === cleanId) &&
        u.isActive !== false
    );

    if (foundUser) {
      const passwordHash = (db.userPasswords && db.userPasswords[foundUser.id]) || '';
      return {
        ...foundUser,
        username: foundUser.username || foundUser.email,
        passwordHash,
      };
    }

    return null;
  } catch (err: any) {
    console.error('[PrismaService] Error in findUserByEmailOrUsername:', err?.message || err);
    return null;
  }
}

export async function createFirstSuperAdmin(data: {
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
}) {
  const userId = generateUUID();
  const now = new Date();
  const username = (data.username || data.email.split('@')[0] || 'admin').trim().toLowerCase();

  // Save to JSON DB
  const db = loadDB();
  const newUser = {
    id: userId,
    name: data.name.trim(),
    username,
    email: data.email.trim().toLowerCase(),
    role: 'SUPER_ADMIN' as const,
    isActive: true,
    createdAt: now.toISOString(),
  };

  db.users.push(newUser);
  if (!db.userPasswords) db.userPasswords = {};
  db.userPasswords[userId] = data.passwordHash;
  saveDB();

  // Try saving to PostgreSQL via Prisma
  if (prismaInstance && isPrismaConnected) {
    try {
      await prismaInstance.user.create({
        data: {
          id: userId,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          passwordHash: data.passwordHash,
          role: 'ADMIN',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      console.log('[Prisma] Super Admin persisted to PostgreSQL successfully.');
    } catch (e: any) {
      isPrismaConnected = false;
      console.warn('[Prisma] PostgreSQL create user failed. Saved in store:', e?.message || e);
    }
  }

  return newUser;
}

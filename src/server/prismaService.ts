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

    let dbHost = 'unknown';
    try {
      const parsedUrl = new URL(rawDbUrl);
      dbHost = parsedUrl.hostname;
    } catch {
      const match = rawDbUrl.match(/@([^/:?]+)/);
      if (match) dbHost = match[1];
    }
    const isLocal = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1') || rawDbUrl.includes('[::1]');

    console.log(`[Prisma Diagnostic] Environment: ${isProd ? 'production' : 'development'}, URL present: ${Boolean(rawDbUrl)}, Host: ${dbHost}, isLocal: ${isLocal}`);

    if (isProd) {
      if (!rawDbUrl) {
        throw new Error('CRITICAL DATABASE ERROR: DATABASE_URL is not configured for production environment in Vercel.');
      }
      if (isLocal) {
        throw new Error('CRITICAL DATABASE ERROR: Production DATABASE_URL points to localhost/127.0.0.1. Configure a hosted PostgreSQL database in Vercel environment variables.');
      }
    }

    if (!rawDbUrl) {
      console.log('[Prisma] DATABASE_URL not configured. Running on local store mode.');
      isPrismaConnected = false;
      return;
    }

    try {
      let connected = false;
      let lastError: any = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const prismaModule = await import('@prisma/client').catch(() => null);
          const adapterModule = await import('@prisma/adapter-pg').catch(() => null);

          if (prismaModule && ('PrismaClient' in prismaModule) && adapterModule && ('PrismaPg' in adapterModule)) {
            const PrismaClientClass = (prismaModule as any).PrismaClient;
            const PrismaPgClass = (adapterModule as any).PrismaPg;
            const pool = new pg.Pool({
              connectionString: rawDbUrl,
              connectionTimeoutMillis: isLocal && !isProd ? 1500 : 15000,
              ssl: isLocal ? false : { rejectUnauthorized: false },
            });

            pool.on('error', () => {
              isPrismaConnected = false;
            });

            // Test connectivity with lightweight SELECT 1
            await pool.query('SELECT 1');

            const adapter = new PrismaPgClass(pool);
            prismaInstance = new PrismaClientClass({ adapter });
            await prismaInstance.$connect();
            isPrismaConnected = true;
            connected = true;
            console.log(`[Prisma] Connected successfully to PostgreSQL database at host: ${dbHost} (attempt ${attempt})`);

            // Trigger one-time background migration from JSON to Postgres if DB connected
            import('../../scripts/migrate-json-to-postgres')
              .then((m) => m.migrateJsonToPostgres())
              .catch(() => {});
            break;
          } else {
            isPrismaConnected = false;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errCode = err?.code || '';
          const errMsg = err?.message || 'Unknown error';

          // If development and localhost ECONNREFUSED, fail fast immediately without retries/spam
          if (!isProd && isLocal && (errCode === 'ECONNREFUSED' || errMsg.includes('ECONNREFUSED'))) {
            console.log('[Prisma] Local PostgreSQL server not running on localhost. Using local storage fallback mode.');
            break;
          }

          console.warn(`[Prisma] Connection attempt ${attempt}/${maxRetries} failed for host ${dbHost}: ${errMsg}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!connected && lastError) {
        isPrismaConnected = false;
        prismaInstance = null;
        prismaInitPromise = null;
        console.warn('[Prisma] PostgreSQL database not connected after retries. Using local storage store fallback.');
      }
    } catch (err: any) {
      isPrismaConnected = false;
      prismaInstance = null;
      prismaInitPromise = null;
      console.warn('[Prisma] PostgreSQL connection exception safely handled:', err?.message || 'Connection failed');
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

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmailOrUsername, getUserCount } from '../prismaService';
import { loadDB, saveDB, logActivity } from '../store';

const router = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'unique-sweets-secret-key-2026';

router.post('/login', async (req: Request, res: Response) => {
  const emailInput = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
  console.log(`[Auth API] POST /api/auth/login received for identifier: "${emailInput}"`);

  try {
    const passwordInput = String(req.body?.password || '').trim();

    if (!emailInput || !passwordInput) {
      console.warn('[Auth API] Missing email/username or password in request body.');
      return res.status(400).json({ error: 'Email/username and password are required.' });
    }

    const totalUsers = await getUserCount();
    console.log(`[Auth API] Total users in system: ${totalUsers}`);

    if (totalUsers === 0) {
      console.warn('[Auth API] Zero users in database. Requiring setup wizard.');
      return res.status(400).json({
        error: 'No user accounts exist in the system. Please complete the initial setup wizard first.',
        isSetupRequired: true,
      });
    }

    const user = await findUserByEmailOrUsername(emailInput);
    if (!user) {
      console.warn(`[Auth API] User identifier "${emailInput}" not found in database or store.`);
      return res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    }

    if (!user.isActive) {
      console.warn(`[Auth API] Account for "${emailInput}" is deactivated.`);
      return res.status(401).json({ error: 'Account is inactive. Please contact an administrator.' });
    }

    if (!user.passwordHash) {
      console.warn(`[Auth API] User "${emailInput}" has no stored password hash.`);
      return res.status(401).json({ error: 'Invalid user credentials.' });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = bcrypt.compareSync(passwordInput, user.passwordHash);
    } catch (bcryptErr: any) {
      console.error('[Auth API] Error during password hash comparison:', bcryptErr?.message || bcryptErr);
      return res.status(500).json({ error: 'Authentication verification failed due to internal error.' });
    }

    if (!isPasswordValid) {
      console.warn(`[Auth API] Invalid password provided for user "${emailInput}".`);
      return res.status(401).json({ error: 'Invalid credentials. Check your password.' });
    }

    const jwtSecret = getJwtSecret();
    const uAny = user as any;
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username || user.email,
        role: user.role,
        name: user.name,
        branchId: uAny.branchId,
        registerId: uAny.registerId,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log(`[Auth API] User "${user.email || user.username}" (${user.role}) authenticated successfully.`);

    // Non-blocking update of lastLoginAt and activity logging
    try {
      const db = loadDB();
      const dbUser = (db.users || []).find((u) => u.id === user.id);
      if (dbUser) {
        dbUser.lastLoginAt = new Date().toISOString();
        saveDB();
      }
      logActivity(
        user.id,
        user.name,
        'User Login',
        'Authentication',
        `Logged in successfully as ${user.role}`
      );
    } catch (storeErr) {
      console.warn('[Auth API] Non-fatal store update warning during login:', storeErr);
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username || user.email,
        email: user.email,
        phone: uAny.phone,
        role: user.role,
        branchId: uAny.branchId,
        branchName: uAny.branchName,
        registerId: uAny.registerId,
        registerName: uAny.registerName,
        isActive: user.isActive,
        lastLoginAt: uAny.lastLoginAt || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Auth API Fatal Exception] Uncaught error in POST /api/auth/login:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    return res.status(500).json({
      error: 'Authentication failed due to server error.',
      details: process.env.NODE_ENV === 'production' ? error?.message || 'Internal Server Error' : error?.stack,
    });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = getJwtSecret();

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err: any) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    let user = await findUserByEmailOrUsername(decoded.email || decoded.username || decoded.userId);

    if (!user) {
      try {
        const db = loadDB();
        const fallbackUser = (db.users || []).find(
          (u) =>
            u.id === decoded.userId ||
            u.id?.toLowerCase() === decoded.userId?.toLowerCase() ||
            u.email?.toLowerCase() === decoded.email?.toLowerCase() ||
            u.username?.toLowerCase() === decoded.username?.toLowerCase()
        );
        if (fallbackUser) {
          const passwordHash = (db.userPasswords && db.userPasswords[fallbackUser.id]) || '';
          user = { ...fallbackUser, username: fallbackUser.username || fallbackUser.email, passwordHash };
        }
      } catch (e) {
        console.warn('[Auth /me] Store fallback search warning:', e);
      }
    }

    if (!user) {
      return res.json({
        user: {
          id: decoded.userId || 'system-admin',
          name: decoded.name || 'System Admin',
          username: decoded.username || decoded.email || 'admin',
          email: decoded.email || 'admin@uniquesweets.com',
          role: decoded.role || 'SUPER_ADMIN',
          branchId: decoded.branchId,
          registerId: decoded.registerId,
          isActive: true,
        },
      });
    }

    const uAny = user as any;
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username || user.email,
        email: user.email,
        phone: uAny.phone,
        role: user.role,
        branchId: uAny.branchId,
        branchName: uAny.branchName,
        registerId: uAny.registerId,
        registerName: uAny.registerName,
        isActive: user.isActive,
        lastLoginAt: uAny.lastLoginAt,
      },
    });
  } catch (err: any) {
    console.error('[Auth /me Error]:', err?.message || err);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;

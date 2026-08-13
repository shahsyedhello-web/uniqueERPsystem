import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { loadDB } from '../store';
import { UserRole } from '../../types/pos';

const JWT_SECRET = process.env.JWT_SECRET || 'unique-sweets-secret-key-2026';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    name: string;
    role: UserRole;
    branchId?: string;
    registerId?: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in with valid credentials.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = loadDB();
    const user = db.users.find(
      (u) =>
        u.id === decoded.userId ||
        u.id?.toLowerCase() === decoded.userId?.toLowerCase() ||
        u.email?.toLowerCase() === decoded.email?.toLowerCase() ||
        u.username?.toLowerCase() === decoded.username?.toLowerCase()
    );

    if (!user) {
      req.user = {
        userId: decoded.userId || 'system-admin',
        email: decoded.email || 'admin@uniquesweets.com',
        username: decoded.username || 'admin',
        name: decoded.name || 'System Admin',
        role: decoded.role || 'SUPER_ADMIN',
        branchId: decoded.branchId,
        registerId: decoded.registerId,
      };
      return next();
    }

    if (user.isActive === false) {
      return res.status(401).json({ error: 'User account is deactivated. Please contact your system administrator.' });
    }

    const uAny = user as any;
    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username || user.email,
      name: user.name,
      role: user.role,
      branchId: uAny.branchId,
      registerId: uAny.registerId,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // SUPER_ADMIN has unrestricted access to all modules and actions
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied: Your role '${req.user.role}' does not have permission to access this module or perform this action.`,
    });
  };
}

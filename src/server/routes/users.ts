import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { User, UserRole } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth and role requirement (SUPER_ADMIN and ADMIN only)
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

// GET ALL USERS
router.get('/', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.users);
});

// CREATE USER
router.post('/', (req: AuthRequest, res) => {
  const { name, username, email, phone, password, role, branchId, registerId } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full Name is required.' });
  }

  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  if (!password || String(password).trim().length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  const userRole: UserRole = role || 'CASHIER';
  const db = loadDB();

  // Check unique username
  const existingUsername = db.users.some(
    (u) => (u.username && u.username.toLowerCase() === cleanUsername) || u.email.toLowerCase() === cleanUsername
  );
  if (existingUsername) {
    return res.status(400).json({ error: `Username '${cleanUsername}' is already taken.` });
  }

  // Check unique email if provided
  const cleanEmail = email ? String(email).trim().toLowerCase() : `${cleanUsername}@uniquesweets.local`;
  if (email) {
    const existingEmail = db.users.some((u) => u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: `Email address '${cleanEmail}' is already in use.` });
    }
  }

  // Branch and Register names lookup
  let branchName = '';
  if (branchId) {
    const br = db.branches.find((b) => b.id === branchId);
    if (br) branchName = br.branchName || br.name;
  }

  let registerName = '';
  if (registerId) {
    const reg = (db.registers || []).find((r) => r.id === registerId);
    if (reg) registerName = reg.name;
  }

  const userId = generateUUID();
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(String(password).trim(), salt);

  const newUser: User = {
    id: userId,
    name: String(name).trim(),
    username: cleanUsername,
    email: cleanEmail,
    phone: phone ? String(phone).trim() : undefined,
    role: userRole,
    branchId: branchId || undefined,
    branchName: branchName || undefined,
    registerId: registerId || undefined,
    registerName: registerName || undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.userPasswords[userId] = hash;

  saveDB();
  logActivity(
    req.user?.userId || 'system',
    req.user?.name || 'Admin',
    'Create User Account',
    'Users & Permissions',
    `Created ${userRole} account '${newUser.name}' (@${newUser.username})`
  );

  res.status(201).json(newUser);
});

// UPDATE USER
router.put('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, username, email, phone, password, role, branchId, registerId, isActive } = req.body;
  const db = loadDB();

  const userIndex = db.users.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const existingUser = db.users[userIndex];

  // Check username uniqueness
  if (username && String(username).trim().toLowerCase() !== (existingUser.username || '').toLowerCase()) {
    const cleanUsername = String(username).trim().toLowerCase();
    if (db.users.some((u) => u.id !== id && ((u.username && u.username.toLowerCase() === cleanUsername) || u.email.toLowerCase() === cleanUsername))) {
      return res.status(400).json({ error: `Username '${cleanUsername}' is already taken.` });
    }
  }

  // Check email uniqueness
  if (email && String(email).trim().toLowerCase() !== existingUser.email.toLowerCase()) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: `Email address '${cleanEmail}' is already in use.` });
    }
  }

  let branchName = existingUser.branchName;
  if (branchId) {
    const br = db.branches.find((b) => b.id === branchId);
    if (br) branchName = br.branchName || br.name;
  }

  let registerName = existingUser.registerName;
  if (registerId) {
    const reg = (db.registers || []).find((r) => r.id === registerId);
    if (reg) registerName = reg.name;
  }

  const newRole = role || existingUser.role;
  const newActive = isActive !== undefined ? Boolean(isActive) : existingUser.isActive;

  // Log role or status change
  if (existingUser.role !== newRole) {
    logActivity(
      req.user?.userId || 'system',
      req.user?.name || 'Admin',
      'Change User Role',
      'Users & Permissions',
      `Changed role of '${existingUser.name}' from ${existingUser.role} to ${newRole}`
    );
  }

  if (existingUser.isActive !== newActive) {
    logActivity(
      req.user?.userId || 'system',
      req.user?.name || 'Admin',
      newActive ? 'Activate User Account' : 'Deactivate User Account',
      'Users & Permissions',
      `${newActive ? 'Activated' : 'Deactivated'} user account '${existingUser.name}'`
    );
  }

  db.users[userIndex] = {
    ...existingUser,
    name: name ? String(name).trim() : existingUser.name,
    username: username ? String(username).trim().toLowerCase() : existingUser.username,
    email: email ? String(email).trim().toLowerCase() : existingUser.email,
    phone: phone !== undefined ? String(phone).trim() : existingUser.phone,
    role: newRole,
    branchId: branchId || existingUser.branchId,
    branchName: branchName,
    registerId: registerId || existingUser.registerId,
    registerName: registerName,
    isActive: newActive,
    updatedAt: new Date().toISOString(),
  };

  if (password && String(password).trim().length > 0) {
    const salt = bcrypt.genSaltSync(10);
    db.userPasswords[id] = bcrypt.hashSync(String(password).trim(), salt);
    logActivity(
      req.user?.userId || 'system',
      req.user?.name || 'Admin',
      'Reset User Password',
      'Users & Permissions',
      `Reset password for user account '${existingUser.name}'`
    );
  }

  saveDB();
  res.json(db.users[userIndex]);
});

// RESET USER PASSWORD
router.post('/:id/reset-password', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  const db = loadDB();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const salt = bcrypt.genSaltSync(10);
  db.userPasswords[id] = bcrypt.hashSync(String(newPassword).trim(), salt);
  saveDB();

  logActivity(
    req.user?.userId || 'system',
    req.user?.name || 'Admin',
    'Reset User Password',
    'Users & Permissions',
    `Admin reset password for user account '${user.name}' (@${user.username})`
  );

  res.json({ success: true, message: `Password reset successfully for user '${user.name}'.` });
});

// TOGGLE USER STATUS (Activate/Deactivate)
router.post('/:id/toggle-status', (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = loadDB();

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  user.isActive = !user.isActive;
  user.updatedAt = new Date().toISOString();
  saveDB();

  logActivity(
    req.user?.userId || 'system',
    req.user?.name || 'Admin',
    user.isActive ? 'Activate User' : 'Deactivate User',
    'Users & Permissions',
    `${user.isActive ? 'Activated' : 'Deactivated'} user account '${user.name}'`
  );

  res.json({ success: true, user });
});

// DELETE USER (Protected - only unused users can be permanently deleted by Super Admin)
router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = loadDB();

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  // Prevent deleting sole Super Admin / Admin account
  if ((user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && db.users.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN').length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the only remaining Admin / Super Admin user account.' });
  }

  // Check transaction history
  const hasSales = (db.sales || []).some((s) => s.cashierName === user.name || s.cashierName === user.username);
  const hasShifts = (db.cashShifts || []).some((s) => s.cashierName === user.name || s.cashierName === user.username);
  const hasPurchases = (db.purchases || []).some((p) => (p as any).createdBy === user.name || (p as any).createdBy === user.id);
  const hasJournals = (db.journalEntries || []).some((j) => j.createdBy === user.name || j.createdBy === user.id);
  const hasAuditLogs = (db.activityLogs || []).some((a) => a.userId === user.id);

  const hasHistory = hasSales || hasShifts || hasPurchases || hasJournals || hasAuditLogs;

  if (hasHistory || user.isActive) {
    return res.status(400).json({
      error: `User account '${user.name}' has historical business records or is active. Permanent deletion is forbidden to preserve audit trails. Please deactivate/suspend the account instead.`,
      canDeactivate: true,
    });
  }

  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only Super Admin can permanently remove unused user accounts.' });
  }

  db.users = db.users.filter((u) => u.id !== id);
  delete db.userPasswords[id];

  saveDB();
  logActivity(
    req.user?.userId || 'system',
    req.user?.name || 'Super Admin',
    'Permanently Delete Unused User',
    'Users & Permissions',
    `Permanently deleted unused user account '${user.name}'`
  );

  res.json({ message: 'Unused user account deleted successfully.' });
});

// ROLES
router.get('/roles', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.roles);
});

// ACTIVITY & AUDIT LOGS
router.get('/logs', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.activityLogs);
});

export default router;

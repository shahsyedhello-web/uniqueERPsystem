import { Router } from 'express';
import { loadDB, saveDB, logActivity } from '../store';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.settings);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), (req: AuthRequest, res) => {
  const db = loadDB();
  db.settings = {
    ...db.settings,
    ...req.body,
  };

  saveDB();
  logActivity(req.user?.userId || 'system', req.user?.name || 'Admin', 'Update Settings', 'Settings', 'Updated business settings');

  res.json(db.settings);
});

// BACKUP DATABASE JSON
router.get('/backup', requireRole('SUPER_ADMIN', 'ADMIN'), (req: AuthRequest, res) => {
  const db = loadDB();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=unique_sweets_pos_backup_${Date.now()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

// RESTORE DATABASE JSON
router.post('/restore', requireRole('SUPER_ADMIN', 'ADMIN'), (req: AuthRequest, res) => {
  const backupData = req.body;
  if (!backupData || !backupData.users || !backupData.products) {
    return res.status(400).json({ error: 'Invalid POS backup JSON file.' });
  }

  const db = loadDB();
  Object.assign(db, backupData);
  saveDB();
  logActivity(req.user?.userId || 'system', req.user?.name || 'Admin', 'Restore Database', 'Backup', 'Restored system database from backup JSON file');

  res.json({ message: 'Database restored successfully!' });
});

export default router;

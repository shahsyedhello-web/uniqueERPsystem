import { Router } from 'express';
import { loadDB, saveDB, logActivity } from '../store';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KITCHEN'));

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.kitchenOrders);
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // PENDING, PREPARING, READY, SERVED
  const db = loadDB();

  const kot = db.kitchenOrders.find((k) => k.id === id);
  if (!kot) {
    return res.status(404).json({ error: 'Kitchen order not found.' });
  }

  kot.status = status;
  kot.items.forEach((item) => {
    item.status = status === 'SERVED' ? 'READY' : status;
  });

  saveDB();
  logActivity('system', 'Kitchen', 'Update KOT Status', 'Kitchen', `KOT #${kot.orderNo} status set to ${status}`);

  res.json(kot);
});

export default router;

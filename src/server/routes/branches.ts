import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Branch } from '../../types/pos';

const router = Router();

// Helper to calculate auto-generated branch code e.g. BR-0001, BR-0002
function generateNextBranchCode(branches: Branch[]): string {
  let maxNum = 0;
  for (const b of branches) {
    const code = b.branchCode || b.code || '';
    const match = code.match(/BR-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `BR-${nextNum.toString().padStart(4, '0')}`;
}

// GET /api/branches - fetch all branches with optional search/pagination/status filtering
router.get('/', (req, res) => {
  const db = loadDB();
  let result = db.branches || [];

  const { search, status } = req.query;

  if (status && typeof status === 'string') {
    result = result.filter((b) => b.status === status.toUpperCase());
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (b) =>
        (b.branchName && b.branchName.toLowerCase().includes(q)) ||
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.branchCode && b.branchCode.toLowerCase().includes(q)) ||
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.manager && b.manager.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q))
    );
  }

  // Ensure Head Office is always listed first, then by branchCode
  result.sort((a, b) => {
    if (a.isHeadOffice || a.isMain) return -1;
    if (b.isHeadOffice || b.isMain) return 1;
    return (a.branchCode || a.code || '').localeCompare(b.branchCode || b.code || '');
  });

  res.json(result);
});

// GET /api/branches/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const branch = db.branches.find((b) => b.id === id);
  if (!branch) {
    return res.status(404).json({ error: 'Branch not found.' });
  }
  res.json(branch);
});

// POST /api/branches - Create new branch with auto-generated code
router.post('/', (req, res) => {
  const { branchName, name, phone, email, address, city, manager, status, isHeadOffice } = req.body;
  const finalBranchName = (branchName || name || '').trim();

  if (!finalBranchName) {
    return res.status(400).json({ error: 'Branch Name is required.' });
  }

  const db = loadDB();
  const nextCode = generateNextBranchCode(db.branches);
  const now = new Date().toISOString();
  const setHeadOffice = Boolean(isHeadOffice);

  // Only one Head Office allowed - if setting this as Head Office, unset other branches
  if (setHeadOffice) {
    db.branches.forEach((b) => {
      b.isHeadOffice = false;
      b.isMain = false;
    });
  }

  const newBranch: Branch = {
    id: generateUUID(),
    branchCode: nextCode,
    branchName: finalBranchName,
    phone: phone || '',
    email: email || '',
    address: address || '',
    city: city || '',
    manager: manager || '',
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    isHeadOffice: setHeadOffice,
    createdAt: now,
    updatedAt: now,
    name: finalBranchName,
    code: nextCode,
    isMain: setHeadOffice,
  };

  db.branches.unshift(newBranch);
  saveDB();
  logActivity('system', 'Admin', 'Create Branch', 'Branch Management', `Created branch ${finalBranchName} (${nextCode})`);

  res.status(201).json(newBranch);
});

// PUT /api/branches/:id - Update existing branch
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.branches.findIndex((b) => b.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  const existing = db.branches[index];
  const { branchName, name, phone, email, address, city, manager, status, isHeadOffice } = req.body;
  const updatedBranchName = branchName !== undefined ? branchName : (name !== undefined ? name : existing.branchName || existing.name);

  if (!updatedBranchName || updatedBranchName.trim() === '') {
    return res.status(400).json({ error: 'Branch Name is required.' });
  }

  const now = new Date().toISOString();
  const setHeadOffice = isHeadOffice !== undefined ? Boolean(isHeadOffice) : Boolean(existing.isHeadOffice || existing.isMain);

  // Check if trying to unset Head Office when no other Head Office exists
  if (!setHeadOffice && (existing.isHeadOffice || existing.isMain)) {
    const otherHeadOffice = db.branches.find((b) => b.id !== id && (b.isHeadOffice || b.isMain));
    if (!otherHeadOffice) {
      return res.status(400).json({ error: 'At least one branch must remain designated as Head Office.' });
    }
  }

  // If set to Head Office, unset on all other branches
  if (setHeadOffice) {
    db.branches.forEach((b) => {
      if (b.id !== id) {
        b.isHeadOffice = false;
        b.isMain = false;
      }
    });
  }

  const code = existing.branchCode || existing.code;

  db.branches[index] = {
    ...existing,
    branchName: updatedBranchName.trim(),
    name: updatedBranchName.trim(),
    phone: phone !== undefined ? phone : existing.phone,
    email: email !== undefined ? email : existing.email,
    address: address !== undefined ? address : existing.address,
    city: city !== undefined ? city : existing.city,
    manager: manager !== undefined ? manager : existing.manager,
    status: status !== undefined ? status : existing.status,
    isHeadOffice: setHeadOffice,
    isMain: setHeadOffice,
    updatedAt: now,
  };

  saveDB();
  logActivity('system', 'Admin', 'Update Branch', 'Branch Management', `Updated branch ${updatedBranchName} (${code})`);

  res.json(db.branches[index]);
});

// PATCH /api/branches/:id/status - Toggle or set branch status (ACTIVE / INACTIVE)
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = loadDB();
  const branch = db.branches.find((b) => b.id === id);

  if (!branch) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  const newStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  if (newStatus === 'INACTIVE' && (branch.isHeadOffice || branch.isMain)) {
    return res.status(400).json({ error: 'Head Office branch cannot be deactivated.' });
  }

  branch.status = newStatus;
  branch.updatedAt = new Date().toISOString();
  saveDB();

  logActivity('system', 'Admin', 'Toggle Branch Status', 'Branch Management', `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} branch ${branch.branchName || branch.name}`);

  res.json(branch);
});

// DELETE /api/branches/:id - Delete branch
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();

  const branch = db.branches.find((b) => b.id === id);
  if (!branch) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  if (branch.isHeadOffice || branch.isMain) {
    return res.status(400).json({ error: 'Head Office branch cannot be deleted. Assign another branch as Head Office first.' });
  }

  db.branches = db.branches.filter((b) => b.id !== id);
  saveDB();
  logActivity('system', 'Admin', 'Delete Branch', 'Branch Management', `Deleted branch ${branch.branchName || branch.name} (${branch.branchCode || branch.code})`);

  res.json({ message: 'Branch deleted successfully.' });
});

export default router;

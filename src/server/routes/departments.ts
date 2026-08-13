import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Department } from '../../types/pos';

const router = Router();

// GET all departments
router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.departments || []);
});

// CREATE department
router.post('/', (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Department Name and Code are required.' });
  }

  const db = loadDB();
  db.departments = db.departments || [];

  const exists = db.departments.some(
    (d) => d.code.toLowerCase() === code.trim().toLowerCase() || d.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: 'Department with this Name or Code already exists.' });
  }

  const newDept: Department = {
    id: generateUUID(),
    name: name.trim(),
    code: code.trim().toUpperCase(),
    description: description ? description.trim() : '',
    createdAt: new Date().toISOString(),
  };

  db.departments.unshift(newDept);
  saveDB();
  logActivity('system', 'HR', 'Create Department', 'Departments', `Created department ${newDept.name} (${newDept.code})`);

  res.status(201).json(newDept);
});

// UPDATE department
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  const db = loadDB();
  db.departments = db.departments || [];

  const index = db.departments.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Department not found.' });
  }

  const existing = db.departments[index];
  db.departments[index] = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    code: code !== undefined ? code.trim().toUpperCase() : existing.code,
    description: description !== undefined ? description.trim() : existing.description,
  };

  saveDB();
  res.json(db.departments[index]);
});

// DELETE department
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  db.departments = db.departments || [];

  const dept = db.departments.find((d) => d.id === id);
  if (!dept) {
    return res.status(404).json({ error: 'Department not found.' });
  }

  const linkedEmps = db.employees.filter((e) => e.departmentId === id || e.department === dept.name);
  if (linkedEmps.length > 0) {
    return res.status(400).json({
      error: `Cannot delete department "${dept.name}". It currently has ${linkedEmps.length} employee(s) assigned to it (e.g. "${linkedEmps[0].name}"). Please reassign these employees before deleting the department.`
    });
  }

  db.departments = db.departments.filter((d) => d.id !== id);
  saveDB();
  logActivity('system', 'HR', 'Delete Department', 'Departments', `Deleted department ${dept.name}`);

  res.json({ message: `Department "${dept.name}" deleted successfully.` });
});

export default router;

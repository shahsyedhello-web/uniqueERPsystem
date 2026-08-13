import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Employee, Attendance, Payroll } from '../../types/pos';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

// EMPLOYEES
router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});

router.post('/', (req, res) => {
  const { name, designation, department, phone, email, salary, joiningDate, employeeCode } = req.body;
  if (!name || !phone || !salary) {
    return res.status(400).json({ error: 'Name, Phone, and Salary are required.' });
  }

  const db = loadDB();
  const code = employeeCode || 'EMP-' + (db.employees.length + 1).toString().padStart(3, '0');

  const newEmp: Employee = {
    id: generateUUID(),
    employeeCode: code,
    name,
    designation: designation || 'Staff',
    department: department || 'Sales',
    phone,
    email,
    salary: Number(salary),
    joiningDate: joiningDate || new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  db.employees.unshift(newEmp);
  saveDB();
  logActivity('system', 'User', 'Create Employee', 'Employees', `Added employee ${name} (${code})`);

  res.status(201).json(newEmp);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.employees.findIndex((e) => e.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  const existing = db.employees[index];
  db.employees[index] = {
    ...existing,
    ...req.body,
    salary: req.body.salary !== undefined ? Number(req.body.salary) : existing.salary,
  };

  saveDB();
  res.json(db.employees[index]);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();

  const emp = db.employees.find((e) => e.id === id);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  const hasAttendance = db.attendances?.some((a) => a.employeeId === id);
  const hasPayroll = db.payrolls?.some((p) => p.employeeId === id);

  if (hasAttendance || hasPayroll) {
    return res.status(400).json({
      error: `Cannot delete employee "${emp.name}". They have active attendance or payroll history on record. You can set their status to "INACTIVE" to deactivate them instead.`
    });
  }

  db.employees = db.employees.filter((e) => e.id !== id);
  saveDB();
  logActivity('system', 'HR', 'Delete Employee', 'Employees', `Deleted employee ${emp.name}`);

  res.json({ message: `Employee "${emp.name}" deleted successfully.` });
});

// ATTENDANCE
router.get('/attendance', (req, res) => {
  const db = loadDB();
  res.json(db.attendances);
});

router.post('/attendance', (req, res) => {
  const { employeeId, date, checkIn, checkOut, status, notes } = req.body;
  if (!employeeId || !status) {
    return res.status(400).json({ error: 'Employee and Attendance Status required.' });
  }

  const db = loadDB();
  const emp = db.employees.find((e) => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  const attDate = date || new Date().toISOString().split('T')[0];

  const att: Attendance = {
    id: generateUUID(),
    employeeId,
    employeeName: emp.name,
    date: attDate,
    checkIn: checkIn || new Date().toISOString(),
    checkOut,
    status,
    notes,
  };

  db.attendances.unshift(att);
  saveDB();

  res.status(201).json(att);
});

// PAYROLL
router.get('/payroll', (req, res) => {
  const db = loadDB();
  res.json(db.payrolls);
});

router.post('/payroll', (req, res) => {
  const { employeeId, monthYear, bonuses, deductions } = req.body;
  if (!employeeId || !monthYear) {
    return res.status(400).json({ error: 'Employee and Month/Year (YYYY-MM) required.' });
  }

  const db = loadDB();
  const emp = db.employees.find((e) => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  const bonusAmt = Number(bonuses) || 0;
  const dedAmt = Number(deductions) || 0;
  const net = emp.salary + bonusAmt - dedAmt;

  const pay: Payroll = {
    id: generateUUID(),
    employeeId,
    employeeName: emp.name,
    monthYear,
    basicSalary: emp.salary,
    bonuses: bonusAmt,
    deductions: dedAmt,
    netSalary: net,
    paymentStatus: 'PAID',
    paymentDate: new Date().toISOString(),
  };

  db.payrolls.unshift(pay);
  saveDB();
  logActivity('system', 'HR', 'Process Payroll', 'Employees', `Processed salary for ${emp.name} (${monthYear}) Net: ${net}`);

  res.status(201).json(pay);
});

export default router;

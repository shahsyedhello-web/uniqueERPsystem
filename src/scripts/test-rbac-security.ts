import http from 'http';
import bcrypt from 'bcryptjs';
import { loadDB, saveDB, generateUUID } from '../server/store';

function request(method: string, path: string, data?: any, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : undefined;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode || 200, body: json });
          } catch (e) {
            resolve({ status: res.statusCode || 200, body: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runRBACTests() {
  console.log('=== STARTING RBAC SECURITY VERIFICATION SUITE ===\n');

  try {
    // 1. Ensure a known Super Admin exists for test runner
    console.log('1. Setting up admin session...');
    const db = loadDB();
    if (!db.userPasswords) db.userPasswords = {};

    const testAdminEmail = 'rbac_super_admin@uniquesweets.com';
    const testAdminPassword = 'TestPassword123!';
    const passwordHash = bcrypt.hashSync(testAdminPassword, 10);

    let testAdmin = db.users.find((u) => u.email === testAdminEmail);
    if (!testAdmin) {
      testAdmin = {
        id: generateUUID(),
        name: 'RBAC Super Admin',
        email: testAdminEmail,
        username: 'rbacadmin',
        role: 'SUPER_ADMIN',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      db.users.push(testAdmin);
    } else {
      testAdmin.role = 'SUPER_ADMIN';
      testAdmin.isActive = true;
    }

    db.userPasswords[testAdmin.id] = passwordHash;
    saveDB();

    const adminLogin = await request('POST', '/api/auth/login', {
      email: testAdminEmail,
      password: testAdminPassword,
    });

    const adminToken = adminLogin.body.token;
    if (!adminToken) {
      throw new Error('Failed to acquire Super Admin token: ' + JSON.stringify(adminLogin.body));
    }

    // Create Cashier
    const cashierUsername = `cashier_${Date.now()}`;
    const createCashier = await request('POST', '/api/users', {
      name: 'Test Cashier User',
      username: cashierUsername,
      email: `${cashierUsername}@uniquesweets.com`,
      password: 'cashierpass123',
      role: 'CASHIER',
    }, adminToken);

    if (createCashier.status !== 201) {
      throw new Error('Failed to create test cashier user: ' + JSON.stringify(createCashier.body));
    }

    const cashierLogin = await request('POST', '/api/auth/login', {
      email: `${cashierUsername}@uniquesweets.com`,
      password: 'cashierpass123',
    });
    const cashierToken = cashierLogin.body.token;
    if (!cashierToken) throw new Error('Failed to log in as test cashier user.');

    // Create Manager
    const managerUsername = `manager_${Date.now()}`;
    const createManager = await request('POST', '/api/users', {
      name: 'Test Manager User',
      username: managerUsername,
      email: `${managerUsername}@uniquesweets.com`,
      password: 'managerpass123',
      role: 'MANAGER',
    }, adminToken);

    if (createManager.status !== 201) {
      throw new Error('Failed to create test manager user: ' + JSON.stringify(createManager.body));
    }

    const managerLogin = await request('POST', '/api/auth/login', {
      email: `${managerUsername}@uniquesweets.com`,
      password: 'managerpass123',
    });
    const managerToken = managerLogin.body.token;
    if (!managerToken) throw new Error('Failed to log in as test manager user.');

    console.log('   ✅ Cashier & Manager test tokens acquired successfully.\n');

    // 2. Test Cashier Restrictions (Should ALL return 403 Access Denied)
    console.log('2. Testing CASHIER Role Restrictions:');
    
    const cashierFinanceTest = await request('GET', '/api/finance/accounts', undefined, cashierToken);
    console.log(`   - GET /api/finance/accounts: HTTP ${cashierFinanceTest.status} (Expected 403)`);
    if (cashierFinanceTest.status !== 403) throw new Error(`Cashier was not blocked from Finance! Got status ${cashierFinanceTest.status}`);

    const cashierUsersTest = await request('GET', '/api/users', undefined, cashierToken);
    console.log(`   - GET /api/users: HTTP ${cashierUsersTest.status} (Expected 403)`);
    if (cashierUsersTest.status !== 403) throw new Error(`Cashier was not blocked from Users! Got status ${cashierUsersTest.status}`);

    const cashierReportsTest = await request('GET', '/api/reports/sales', undefined, cashierToken);
    console.log(`   - GET /api/reports/sales: HTTP ${cashierReportsTest.status} (Expected 403)`);
    if (cashierReportsTest.status !== 403) throw new Error(`Cashier was not blocked from Reports! Got status ${cashierReportsTest.status}`);

    const cashierProductCreateTest = await request('POST', '/api/products', { name: 'Unauthorized Product' }, cashierToken);
    console.log(`   - POST /api/products: HTTP ${cashierProductCreateTest.status} (Expected 403)`);
    if (cashierProductCreateTest.status !== 403) throw new Error(`Cashier was not blocked from Product Creation! Got status ${cashierProductCreateTest.status}`);

    const cashierSettingsTest = await request('GET', '/api/settings', undefined, cashierToken);
    console.log(`   - GET /api/settings: HTTP ${cashierSettingsTest.status} (Expected 403)`);
    if (cashierSettingsTest.status !== 403) throw new Error(`Cashier was not blocked from Settings! Got status ${cashierSettingsTest.status}`);

    // 3. Test Cashier Allowed Routes
    console.log('\n3. Testing CASHIER Allowed Routes:');
    const cashierGetProducts = await request('GET', '/api/products', undefined, cashierToken);
    console.log(`   - GET /api/products: HTTP ${cashierGetProducts.status} (Expected 200)`);
    if (cashierGetProducts.status !== 200) throw new Error(`Cashier was blocked from viewing products! Got status ${cashierGetProducts.status}`);

    // 4. Test Manager Restrictions
    console.log('\n4. Testing MANAGER Role Restrictions:');
    const managerFinanceTest = await request('GET', '/api/finance/accounts', undefined, managerToken);
    console.log(`   - GET /api/finance/accounts: HTTP ${managerFinanceTest.status} (Expected 403)`);
    if (managerFinanceTest.status !== 403) throw new Error(`Manager was not blocked from Finance! Got status ${managerFinanceTest.status}`);

    const managerUsersTest = await request('GET', '/api/users', undefined, managerToken);
    console.log(`   - GET /api/users: HTTP ${managerUsersTest.status} (Expected 403)`);
    if (managerUsersTest.status !== 403) throw new Error(`Manager was not blocked from Users! Got status ${managerUsersTest.status}`);

    // 5. Cleanup test users
    console.log('\n5. Cleaning up test user accounts...');
    if (createCashier.body.id) await request('DELETE', `/api/users/${createCashier.body.id}`, undefined, adminToken);
    if (createManager.body.id) await request('DELETE', `/api/users/${createManager.body.id}`, undefined, adminToken);
    console.log('   ✅ Test accounts cleaned up.');

    console.log('\n=====================================================');
    console.log('  🎉 ALL RBAC SECURITY VERIFICATION TESTS PASSED!  ');
    console.log('=====================================================\n');
  } catch (err: any) {
    console.error('\n❌ RBAC SECURITY TEST FAILED:', err.message);
    process.exit(1);
  }
}

runRBACTests();

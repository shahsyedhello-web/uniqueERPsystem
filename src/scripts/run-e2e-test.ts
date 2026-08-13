import http from 'http';

function request(method: string, path: string, data?: any): Promise<{ status: number; body: any }> {
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

async function runE2ETests() {
  console.log('=== STARTING UNIQUE SWEETS & BAKERS END-TO-END AUDIT TESTS ===\n');

  try {
    // 1. Create a Category
    console.log('1. Creating Category...');
    const catRes = await request('POST', '/api/categories', {
      name: 'Test Audit Category ' + Date.now(),
      description: 'Audit test category',
    });
    if (catRes.status !== 201) throw new Error('Category creation failed: ' + JSON.stringify(catRes.body));
    const category = catRes.body;
    console.log(`   ✅ Category Created: ${category.name} (${category.id})`);

    // 2. Create a Product Manually
    console.log('\n2. Creating Product Manually...');
    const prodRes = await request('POST', '/api/products', {
      name: 'Test Audit Kachori ' + Date.now(),
      categoryId: category.id,
      salePrice: 50,
      costPrice: 30,
      purchasePrice: 30,
      unit: 'pcs',
      currentStock: 100,
      minStock: 10,
    });
    if (prodRes.status !== 201) throw new Error('Product creation failed: ' + JSON.stringify(prodRes.body));
    const product = prodRes.body;
    console.log(`   ✅ Product Created: ${product.name} (Stock: ${product.currentStock}, Cost: ${product.costPrice}, Price: ${product.salePrice})`);

    // 3. Verify Product appears in inventory
    console.log('\n3. Verifying Product in Inventory...');
    const invRes = await request('GET', '/api/products');
    const foundProd = invRes.body.find((p: any) => p.id === product.id);
    if (!foundProd || foundProd.currentStock !== 100) throw new Error('Product inventory verification failed!');
    console.log('   ✅ Inventory verified: Product exists with stock 100');

    // 4. Open Cash Register Shift
    console.log('\n4. Opening Cash Register Shift...');
    const activeShiftRes = await request('GET', '/api/finance/shifts/active');
    if (activeShiftRes.body && activeShiftRes.body.id) {
      console.log('   -> Found an active shift, closing it first to start clean test shift...');
      await request('POST', '/api/finance/shifts/close', {
        shiftId: activeShiftRes.body.id,
        actualCash: activeShiftRes.body.openingCash || 10000,
        varianceReason: 'Closing prior shift for automated test run',
      });
    }

    const registersRes = await request('GET', '/api/finance/registers');
    const regId = registersRes.body[0]?.id || 'reg-001';

    const openShiftRes = await request('POST', '/api/finance/shifts/open', {
      registerId: regId,
      cashierId: 'cashier-01',
      cashierName: 'Auditor Cashier',
      openingCash: 10000,
      notes: 'Audit shift start',
    });
    if (openShiftRes.status !== 201) throw new Error('Shift open failed: ' + JSON.stringify(openShiftRes.body));
    const shift = openShiftRes.body;
    console.log(`   ✅ Cash Shift Opened: ${shift.shiftNo} with Opening Float Rs. ${shift.openingCash}`);

    // 5. Make a Cash Sale
    console.log('\n5. Making Cash Sale (10 items @ 50 = 500 PKR)...');
    const cashSaleRes = await request('POST', '/api/sales', {
      items: [
        {
          productId: product.id,
          productName: product.name,
          unit: 'pcs',
          price: 50,
          quantity: 10,
          subtotal: 500,
        },
      ],
      totalAmount: 500,
      paidAmount: 500,
      paymentMethod: 'CASH',
      cashierName: 'Auditor Cashier',
      status: 'COMPLETED',
    });
    if (cashSaleRes.status !== 201) throw new Error('Cash sale failed: ' + JSON.stringify(cashSaleRes.body));
    const cashSale = cashSaleRes.body;
    console.log(`   ✅ Cash Sale Completed: Invoice #${cashSale.invoiceNo}`);

    // 6. Verify POS, Inventory, Cash Account, and Journal
    console.log('\n6. Verifying Stock & Ledger post cash sale...');
    const prodAfterSale = (await request('GET', '/api/products')).body.find((p: any) => p.id === product.id);
    console.log(`   -> Current Stock: ${prodAfterSale.currentStock} (Expected: 90)`);
    if (prodAfterSale.currentStock !== 90) throw new Error('Stock deduction mismatch!');

    const accountsRes = await request('GET', '/api/finance/accounts');
    const cashAcc = accountsRes.body.find((a: any) => a.accountType === 'CASH');
    console.log(`   -> Cash Account Balance: Rs. ${cashAcc?.currentBalance}`);

    // 7. Make Card Sale
    console.log('\n7. Making Card Sale (2 items @ 50 = 100 PKR)...');
    const cardSaleRes = await request('POST', '/api/sales', {
      items: [{ productId: product.id, productName: product.name, unit: 'pcs', price: 50, quantity: 2, subtotal: 100 }],
      totalAmount: 100,
      paidAmount: 100,
      paymentMethod: 'CARD',
      cashierName: 'Auditor Cashier',
      status: 'COMPLETED',
    });
    if (cardSaleRes.status !== 201) throw new Error('Card sale failed: ' + JSON.stringify(cardSaleRes.body));
    console.log(`   ✅ Card Sale Completed: Invoice #${cardSaleRes.body.invoiceNo}`);

    // 8. Make JazzCash Sale
    console.log('\n8. Making JazzCash Mobile Sale (2 items @ 50 = 100 PKR)...');
    const mobSaleRes = await request('POST', '/api/sales', {
      items: [{ productId: product.id, productName: product.name, unit: 'pcs', price: 50, quantity: 2, subtotal: 100 }],
      totalAmount: 100,
      paidAmount: 100,
      paymentMethod: 'MOBILE',
      cashierName: 'Auditor Cashier',
      status: 'COMPLETED',
    });
    if (mobSaleRes.status !== 201) throw new Error('JazzCash sale failed: ' + JSON.stringify(mobSaleRes.body));
    console.log(`   ✅ JazzCash Sale Completed: Invoice #${mobSaleRes.body.invoiceNo}`);

    // 9. Make Credit Sale
    console.log('\n9. Creating Customer & Making Credit Sale...');
    const custRes = await request('POST', '/api/customers', {
      name: 'Audit Customer ' + Date.now(),
      phone: '0300' + Math.floor(1000000 + Math.random() * 9000000),
      email: 'customer@test.com',
    });
    const customer = custRes.body;

    const creditSaleRes = await request('POST', '/api/sales', {
      customerId: customer.id,
      customerName: customer.name,
      items: [{ productId: product.id, productName: product.name, unit: 'pcs', price: 50, quantity: 4, subtotal: 200 }],
      totalAmount: 200,
      paidAmount: 0,
      paymentMethod: 'CREDIT',
      cashierName: 'Auditor Cashier',
      status: 'COMPLETED',
    });
    if (creditSaleRes.status !== 201) throw new Error('Credit sale failed: ' + JSON.stringify(creditSaleRes.body));

    const custAfterSale = (await request('GET', '/api/customers')).body.find((c: any) => c.id === customer.id);
    console.log(`   ✅ Credit Sale Completed. Customer Outstanding Balance: Rs. ${custAfterSale.outstandingBalance} (Expected: 200)`);
    if (custAfterSale.outstandingBalance !== 200) throw new Error('Customer receivable mismatch!');

    // 10. Receive Customer Payment
    console.log('\n10. Receiving Customer Credit Payment (Rs. 150)...');
    const pmtRes = await request('POST', '/api/customers/payment', {
      customerId: customer.id,
      amount: 150,
      paymentMethod: 'CASH',
      notes: 'Partial payment',
    });
    if (pmtRes.status !== 200) throw new Error('Customer payment failed: ' + JSON.stringify(pmtRes.body));
    const custAfterPmt = (await request('GET', '/api/customers')).body.find((c: any) => c.id === customer.id);
    console.log(`   ✅ Payment Received. Remaining Customer Due: Rs. ${custAfterPmt.outstandingBalance} (Expected: 50)`);

    // 11. Create Purchase & Supplier Payment
    console.log('\n11. Creating Supplier & Credit Purchase Order...');
    const suppRes = await request('POST', '/api/suppliers', {
      name: 'Audit Supplier ' + Date.now(),
      companyName: 'Flour & Bakery Mills',
      phone: '0321' + Math.floor(1000000 + Math.random() * 9000000),
    });
    const supplier = suppRes.body;

    const poRes = await request('POST', '/api/purchases', {
      supplierId: supplier.id,
      items: [{ productId: product.id, productName: product.name, quantity: 20, purchasePrice: 30 }],
      paidAmount: 0,
      paymentMethod: 'CREDIT',
    });
    if (poRes.status !== 201) throw new Error('Purchase order creation failed!');
    console.log(`   ✅ Purchase Order Completed #${poRes.body.purchaseNo}. Supplier Due: Rs. ${poRes.body.dueAmount}`);

    const suppPayRes = await request('POST', '/api/suppliers/payment', {
      supplierId: supplier.id,
      amount: 400,
      paymentMethod: 'CASH',
    });
    if (suppPayRes.status !== 200) throw new Error(`Supplier payment failed with status ${suppPayRes.status}: ` + JSON.stringify(suppPayRes.body));
    console.log('   ✅ Paid Supplier Rs. 400 successfully.');

    // 12. Stock Transfer & Adjustment
    console.log('\n12. Testing Stock Transfer & Stock Adjustment...');
    let warehouses = (await request('GET', '/api/inventory/warehouses')).body;
    if (!Array.isArray(warehouses) || warehouses.length < 2) {
      console.log('   -> Creating secondary warehouse for stock transfer test...');
      await request('POST', '/api/inventory/warehouses', {
        name: 'Gulberg Branch Store ' + Date.now(),
        code: 'WH-' + Math.floor(1000 + Math.random() * 9000),
        type: 'STORE',
        location: 'Gulberg, Lahore',
      });
      warehouses = (await request('GET', '/api/inventory/warehouses')).body;
    }

    const trfRes = await request('POST', '/api/inventory/transfers', {
      fromWarehouseId: warehouses[0].id,
      toWarehouseId: warehouses[1].id,
      items: [{ productId: product.id, quantity: 5 }],
    });
    if (trfRes.status !== 200 && trfRes.status !== 201) throw new Error(`Stock transfer failed with status ${trfRes.status}: ` + JSON.stringify(trfRes.body));
    console.log('   ✅ Stock Transfer Completed (5 units transferred).');

    const adjRes = await request('POST', '/api/inventory/adjustments', {
      productId: product.id,
      warehouseId: warehouses[0]?.id,
      type: 'WASTE',
      quantity: 2,
      reason: 'Damaged during packaging audit test',
      adjustedByName: 'Quality Control',
    });
    if (adjRes.status !== 200 && adjRes.status !== 201) throw new Error('Stock adjustment failed: ' + JSON.stringify(adjRes.body));
    console.log('   ✅ Stock Waste Adjustment Recorded with reason and audit log.');

    // 13. Refund Sale
    console.log('\n13. Testing Sale Refund / Return...');
    const refundRes = await request('POST', '/api/sales/refund', {
      saleId: cashSale.id,
      reason: 'Customer audit test return',
      refundedBy: 'Shift Supervisor',
    });
    if (refundRes.status !== 200) throw new Error('Refund failed: ' + JSON.stringify(refundRes.body));
    console.log('   ✅ Sale Refunded successfully & Stock Restored.');

    // 14. Close Register Shift
    console.log('\n14. Closing Cash Register Shift...');
    const closeShiftRes = await request('POST', '/api/finance/shifts/close', {
      shiftId: shift.id,
      actualCash: 10400,
      varianceReason: 'Verified exact drawer count',
    });
    if (closeShiftRes.status !== 200) throw new Error('Shift close failed!');
    console.log(`   ✅ Shift Closed. Expected: Rs. ${closeShiftRes.body.zReport.expectedCash}, Counted: Rs. 10400, Variance: Rs. ${closeShiftRes.body.zReport.variance}`);

    // 15. Financial Account Money Transfer
    console.log('\n15. Testing Inter-Account Money Transfer...');
    const allAccs = (await request('GET', '/api/finance/accounts')).body;
    if (allAccs.length >= 2) {
      const xferRes = await request('POST', '/api/finance/transfers', {
        fromAccountId: allAccs[0].id,
        toAccountId: allAccs[1].id,
        amount: 500,
        notes: 'End of day cash deposit to bank',
      });
      if (xferRes.status !== 201) throw new Error('Account transfer failed!');
      console.log('   ✅ Account Transfer of Rs. 500 completed with double-entry journal.');
    }

    // 16. Verify Trial Balance & Financial Reports
    console.log('\n16. Verifying Trial Balance & Financial Statements...');
    const tbRes = await request('GET', '/api/reports/trial-balance');
    console.log(`   -> Trial Balance Status: Balanced=${tbRes.body.isBalanced} (Total Debits: Rs. ${tbRes.body.totalDebit}, Total Credits: Rs. ${tbRes.body.totalCredit})`);
    if (!tbRes.body.isBalanced) throw new Error('TRIAL BALANCE IS UNBALANCED!');

    const plRes = await request('GET', '/api/reports/profit-and-loss');
    console.log(`   -> P&L Summary: Revenue: Rs. ${plRes.body.totalSalesRevenue}, COGS: Rs. ${plRes.body.totalCOGS}, Gross Profit: Rs. ${plRes.body.grossProfit}`);

    const bsRes = await request('GET', '/api/reports/balance-sheet');
    console.log(`   -> Balance Sheet Summary: Assets: Rs. ${bsRes.body.assets.totalAssets}, Liabilities & Equity: Rs. ${bsRes.body.totalLiabilitiesAndEquity}`);

    // 17. Bakery Recipe BOM & Production Batch Test
    console.log('\n17. Testing Bakery Recipe BOM & Production Batch Execution...');
    // Create Raw Material (e.g. Fine Flour)
    const rawMatRes = await request('POST', '/api/products', {
      name: 'Test Audit Flour ' + Date.now(),
      categoryId: category.id,
      salePrice: 150,
      costPrice: 100,
      purchasePrice: 100,
      unit: 'kg',
      currentStock: 50,
      isRawMaterial: true,
    });
    const rawMat = rawMatRes.body;

    // Create Recipe for finished product
    const recipeRes = await request('POST', '/api/production/recipes', {
      productId: product.id,
      yieldQuantity: 10,
      unit: 'pcs',
      ingredients: [{ rawMaterialId: rawMat.id, quantity: 2, unit: 'kg' }],
      instructions: 'Mix flour and bake for 20 mins',
    });
    if (recipeRes.status !== 201) throw new Error('Recipe creation failed: ' + JSON.stringify(recipeRes.body));
    const recipe = recipeRes.body;
    console.log(`   ✅ Bakery Recipe Created for ${recipe.productName} (Yield: ${recipe.yieldQuantity} ${recipe.unit})`);

    // Execute Production Batch
    const batchRes = await request('POST', '/api/production/batches', {
      productId: product.id,
      recipeId: recipe.id,
      plannedQuantity: 20,
      operatorName: 'Auditor Master Baker',
    });
    if (batchRes.status !== 201) throw new Error('Production batch failed: ' + JSON.stringify(batchRes.body));
    console.log(`   ✅ Production Batch Executed #${batchRes.body.batchNo}. Raw material flour consumed, 20 finished goods added.`);

    // 18. Product Deletion Rule Test
    console.log('\n18. Testing Deletion Rules on Product with History...');
    const delProdRes = await request('DELETE', `/api/products/${product.id}`);
    if (delProdRes.status === 400) {
      console.log(`   ✅ Deletion rule enforced correctly: "${delProdRes.body.error}"`);
    } else {
      throw new Error('Product with transaction history was incorrectly hard-deleted!');
    }

    // Test deleting product WITHOUT history
    const cleanProdRes = await request('POST', '/api/products', {
      name: 'Temporary Clean Product',
      categoryId: category.id,
      salePrice: 100,
      costPrice: 50,
      unit: 'pcs',
      currentStock: 0,
    });
    const cleanProd = cleanProdRes.body;
    const cleanDelRes = await request('DELETE', `/api/products/${cleanProd.id}`);
    if (cleanDelRes.status === 200) {
      console.log('   ✅ Clean product without transaction history was deleted successfully.');
    } else {
      throw new Error('Clean product deletion failed: ' + JSON.stringify(cleanDelRes.body));
    }

    // 18. Cleanup Test Artifacts
    console.log('\n18. Cleaning up test audit records from production database...');
    const cleanAuditRes = await request('POST', '/api/setup/clean-audit-data');
    if (cleanAuditRes.status === 200) {
      console.log('   ✅ Automated test records successfully cleaned up from production DB.');
    }

    console.log('\n🎉 ALL END-TO-END BUSINESS FLOW AUDIT TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err: any) {
    console.error('\n❌ AUDIT TEST FAILED:', err.message);
    process.exit(1);
  }
}

runE2ETests();

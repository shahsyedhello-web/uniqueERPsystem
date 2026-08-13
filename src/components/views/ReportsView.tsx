import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { BarChart3, Download, Printer, DollarSign, TrendingUp, Receipt, FileSpreadsheet, FileText, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PrintJob } from '../../types/pos';

export const ReportsView: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'expenses' | 'profit_loss' | 'print_jobs'>('sales');

  useEffect(() => {
    loadReport();
    loadPrintJobs();
  }, []);

  const loadReport = async () => {
    try {
      const data = await apiFetch('/reports/summary');
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPrintJobs = async () => {
    try {
      const jobs = await apiFetch<PrintJob[]>('/hardware/print-jobs');
      setPrintJobs(jobs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await apiFetch(`/hardware/print-jobs/${jobId}/retry`, { method: 'POST' });
      loadPrintJobs();
    } catch (e: any) {
      alert(e.message || 'Failed to retry print job.');
    }
  };

  const exportExcel = () => {
    if (activeTab === 'print_jobs') {
      const dataToExport = printJobs.map((j) => ({
        'Job ID': j.id,
        Timestamp: new Date(j.timestamp).toLocaleString(),
        User: j.userName,
        Printer: j.printerName,
        'Job Type': j.jobType,
        Product: j.productName,
        Copies: j.copies,
        Status: j.status,
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PrintJobs');
      XLSX.writeFile(wb, `Print_Jobs_Log_${Date.now()}.xlsx`);
      return;
    }

    if (!report) return;

    let dataToExport: any[] = [];
    let fileName = 'unique_sweets_report';

    if (activeTab === 'sales' && report.sales) {
      dataToExport = report.sales.map((s: any) => ({
        'Invoice #': s.invoiceNo,
        Customer: s.customerName,
        'Payment Method': s.paymentMethod,
        Subtotal: s.subtotal,
        Discount: s.discountAmount,
        'Total Amount': s.totalAmount,
        Date: new Date(s.createdAt).toLocaleString(),
      }));
      fileName = 'Sales_Report';
    } else if (activeTab === 'expenses' && report.expenses) {
      dataToExport = report.expenses.map((e: any) => ({
        ID: e.id,
        Category: e.category,
        Title: e.title,
        Amount: e.amount,
        PaymentMethod: e.paymentMethod,
        CreatedBy: e.createdByName,
        Date: new Date(e.createdAt).toLocaleString(),
      }));
      fileName = 'Expenses_Report';
    } else {
      dataToExport = (report.sales || []).map((s: any) => ({
        'Invoice #': s.invoiceNo,
        Customer: s.customerName,
        'Total Amount': s.totalAmount,
        Date: new Date(s.createdAt).toLocaleString(),
      }));
      fileName = 'Financial_Overview';
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReportData');
    XLSX.writeFile(wb, `${fileName}_${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Unique Sweets & Bakers - Financial Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    if (activeTab === 'sales' && report.sales) {
      const tableData = report.sales.map((s: any) => [
        s.invoiceNo,
        s.customerName,
        s.paymentMethod,
        `Rs. ${s.subtotal}`,
        `Rs. ${s.discountAmount}`,
        `Rs. ${s.totalAmount}`,
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Invoice #', 'Customer', 'Payment', 'Subtotal', 'Discount', 'Total']],
        body: tableData,
      });
    } else if (activeTab === 'expenses' && report.expenses) {
      const tableData = report.expenses.map((e: any) => [
        e.category,
        e.title,
        `Rs. ${e.amount}`,
        e.paymentMethod,
        e.createdByName,
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Category', 'Title', 'Amount', 'Payment', 'User']],
        body: tableData,
      });
    }

    doc.save(`unique_sweets_report_${Date.now()}.pdf`);
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Loading financial reports...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>Financial Reports & Hardware Print Logs</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Sales summaries, expense breakdowns, P&L statements, and real Windows hardware print job audits.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sales' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Sales Summary
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'purchases' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Purchases
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'expenses' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Expenses Ledger
        </button>
        <button
          onClick={() => setActiveTab('profit_loss')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'profit_loss' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveTab('print_jobs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
            activeTab === 'print_jobs' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Hardware Print Jobs ({printJobs.length})</span>
        </button>
      </div>

      {/* Sales Report Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-400 font-semibold text-xs">Total Sales Revenue</div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                Rs. {(report?.totalSalesAmount || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-400 font-semibold text-xs">Total Invoices</div>
              <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
                {report?.sales?.length || 0}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-400 font-semibold text-xs">Total Expenses</div>
              <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                Rs. {(report?.totalExpenseAmount || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-800 uppercase tracking-wider">
              Completed Sales Invoices
            </div>
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Payment</th>
                  <th className="p-3.5">Subtotal</th>
                  <th className="p-3.5">Discount</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {report?.sales?.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold font-mono text-blue-600">{s.invoiceNo}</td>
                    <td className="p-3.5 text-slate-900 font-bold">{s.customerName}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{s.paymentMethod}</td>
                    <td className="p-3.5 font-mono">Rs. {s.subtotal}</td>
                    <td className="p-3.5 font-mono text-amber-600">Rs. {s.discountAmount}</td>
                    <td className="p-3.5 font-black text-emerald-600 font-mono text-sm">Rs. {s.totalAmount}</td>
                    <td className="p-3.5 text-slate-500 text-[11px]">{new Date(s.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-3">Purchases & Goods Receipts</h2>
          <p className="text-xs text-slate-500">All procurement orders, supplier stock receipts, and invoice verification history.</p>
          <div className="p-8 text-center text-slate-400 font-semibold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No procurement orders recorded in current active filter period.
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-800 uppercase tracking-wider">
            Operational Expenses Ledger
          </div>
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Title</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5">Log User</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {report?.expenses?.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50/80">
                  <td className="p-3.5 font-bold text-slate-900">{e.category}</td>
                  <td className="p-3.5 text-slate-700">{e.title}</td>
                  <td className="p-3.5 font-semibold text-slate-800">{e.paymentMethod}</td>
                  <td className="p-3.5 text-slate-600">{e.createdByName}</td>
                  <td className="p-3.5 font-black text-rose-600 font-mono">Rs. {e.amount}</td>
                  <td className="p-3.5 text-slate-500 text-[11px]">{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Profit & Loss Statement */}
      {activeTab === 'profit_loss' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 max-w-3xl shadow-xs">
          <h2 className="text-base font-black text-slate-900 border-b pb-3">Profit & Loss Summary Statement</h2>
          <div className="space-y-3 text-xs font-semibold">
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-700">Gross Sales Revenue</span>
              <span className="font-mono text-slate-900">Rs. {report?.totalSalesAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-700">Less: Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-amber-700">- Rs. {report?.totalCOGS?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded-xl text-blue-900 font-bold border border-blue-100">
              <span>Gross Profit Margin</span>
              <span className="font-mono">Rs. {(report?.totalSalesAmount - report?.totalCOGS)?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-700">Less: Operating Expenses</span>
              <span className="font-mono text-rose-600">- Rs. {report?.totalExpenseAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-emerald-50 rounded-xl text-emerald-900 font-black border border-emerald-200 text-sm">
              <span>Net Profit / (Loss)</span>
              <span className="font-mono">Rs. {report?.netProfit?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Print Jobs Log Tab */}
      {activeTab === 'print_jobs' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Windows Hardware Print Jobs Log</h2>
              <p className="text-[11px] text-slate-500">Realtime audit log of receipt, barcode label, and kitchen KOT print jobs submitted to Windows Spooler.</p>
            </div>
            <button
              onClick={loadPrintJobs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Job ID</th>
                <th className="p-3.5">Date / Time</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Printer Name</th>
                <th className="p-3.5">Job Type</th>
                <th className="p-3.5">Product / Details</th>
                <th className="p-3.5">Copies</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {printJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                    No print jobs recorded yet. Try printing a barcode label or test receipt.
                  </td>
                </tr>
              ) : (
                printJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold font-mono text-slate-600">{j.id}</td>
                    <td className="p-3.5 text-slate-600 text-[11px]">{new Date(j.timestamp).toLocaleString()}</td>
                    <td className="p-3.5 font-bold text-slate-900">{j.userName}</td>
                    <td className="p-3.5 font-semibold text-blue-700">{j.printerName}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 font-bold text-slate-700 rounded-md text-[10px]">
                        {j.jobType}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-800 font-semibold">{j.productName}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">{j.copies}</td>
                    <td className="p-3.5">
                      {j.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>SUCCESS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-md text-[10px]" title={j.errorMessage}>
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleRetryJob(j.id)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px]"
                      >
                        Reprint
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

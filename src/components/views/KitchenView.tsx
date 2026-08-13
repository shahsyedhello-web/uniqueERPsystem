import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { KitchenOrder } from '../../types/pos';
import { UtensilsCrossed, Clock, CheckCircle, Flame } from 'lucide-react';

export const KitchenView: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // Live poll KOT board every 5s
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const data = await apiFetch<KitchenOrder[]>('/kitchen');
      setOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: string, newStatus: 'PREPARING' | 'READY' | 'SERVED') => {
    try {
      await apiFetch(`/kitchen/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
    } catch (e: any) {
      alert(e.message || 'Status update failed');
    }
  };

  const pending = orders.filter((o) => o.status === 'PENDING');
  const preparing = orders.filter((o) => o.status === 'PREPARING');
  const ready = orders.filter((o) => o.status === 'READY');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            <span>Bakery Kitchen Order Tickets (KOT)</span>
          </h1>
          <p className="text-xs text-slate-400">Live order queue routed automatically from Cashier POS</p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>Live Refreshing (5s)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PENDING COLUMN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>New Orders ({pending.length})</span>
            </span>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {pending.map((order) => (
              <div key={order.id} className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-4 space-y-3 shadow-lg">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-100">{order.orderNo}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Invoice #{order.invoiceNo}</div>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-200">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-medium">
                      <span>{item.productName}</span>
                      <span className="font-bold text-amber-400 font-mono">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => updateStatus(order.id, 'PREPARING')}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-md"
                >
                  <Flame className="w-4 h-4" />
                  <span>Start Baking / Preparing</span>
                </button>
              </div>
            ))}

            {pending.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-xs">No pending kitchen orders</div>
            )}
          </div>
        </div>

        {/* PREPARING COLUMN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              <span>In Preparation ({preparing.length})</span>
            </span>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {preparing.map((order) => (
              <div key={order.id} className="bg-slate-800/80 border border-blue-500/30 rounded-xl p-4 space-y-3 shadow-lg">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-100">{order.orderNo}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Invoice #{order.invoiceNo}</div>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full">
                    Baking in Progress
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-200">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-medium">
                      <span>{item.productName}</span>
                      <span className="font-bold text-blue-400 font-mono">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => updateStatus(order.id, 'READY')}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-md"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark Ready for Counter</span>
                </button>
              </div>
            ))}

            {preparing.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-xs">No active preparing items</div>
            )}
          </div>
        </div>

        {/* READY / SERVED COLUMN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>Ready for Pickup ({ready.length})</span>
            </span>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {ready.map((order) => (
              <div key={order.id} className="bg-slate-800/80 border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-lg opacity-80">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-100">{order.orderNo}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Invoice #{order.invoiceNo}</div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                </div>

                <button
                  onClick={() => updateStatus(order.id, 'SERVED')}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-xs"
                >
                  Archive Order Ticket
                </button>
              </div>
            ))}

            {ready.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-xs">No ready orders</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

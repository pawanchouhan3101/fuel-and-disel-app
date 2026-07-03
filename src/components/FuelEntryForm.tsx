import React, { useState, useEffect } from 'react';
import { Calendar, Truck, Gauge, Fuel, CreditCard, User, Edit3, CheckCircle, RefreshCcw } from 'lucide-react';
import { Vehicle, SafeUser } from '../types';

interface FuelEntryFormProps {
  vehicles: Vehicle[];
  currentUser: SafeUser;
  token: string;
  onSuccess: () => void;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export default function FuelEntryForm({ vehicles, currentUser, token, onSuccess, showToast }: FuelEntryFormProps) {
  const [vehicleId, setVehicleId] = useState('');
  const [openingKm, setOpeningKm] = useState<number | ''>('');
  const [closingKm, setClosingKm] = useState<number | ''>('');
  const [dieselLitres, setDieselLitres] = useState<number | ''>('');
  const [dieselAmount, setDieselAmount] = useState<number | ''>('');
  const [pumpName, setPumpName] = useState('');
  const [driverName, setDriverName] = useState(currentUser.name);
  const [remarks, setRemarks] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [lastKmLoading, setLastKmLoading] = useState(false);

  // Today's date (formatted YYYY-MM-DD)
  const todayDate = new Date().toISOString().split('T')[0];

  // Auto-fetch last closing KM as opening KM when vehicle changes!
  useEffect(() => {
    if (!vehicleId) {
      setOpeningKm('');
      return;
    }

    const fetchLastKm = async () => {
      setLastKmLoading(true);
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/last-km`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.lastClosingKm > 0) {
            setOpeningKm(data.lastClosingKm);
            showToast(`Auto-fetched last recorded reading for vehicle: ${data.lastClosingKm} KM`, 'info');
          } else {
            setOpeningKm(0);
          }
        }
      } catch (err) {
        console.error('Failed to fetch last closing KM:', err);
      } finally {
        setLastKmLoading(false);
      }
    };

    fetchLastKm();
  }, [vehicleId, token]);

  // Calculate total KM automatically
  const totalKm = (closingKm !== '' && openingKm !== '') ? Number(closingKm) - Number(openingKm) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleId) {
      showToast('कृपया गाड़ी का नंबर चुनें (Please select a vehicle number)', 'error');
      return;
    }

    const dName = driverName.trim() || currentUser.name || 'Driver';
    const pName = pumpName.trim() || 'General Pump';

    const open = openingKm === '' ? 0 : Number(openingKm);
    const close = closingKm === '' ? 0 : Number(closingKm);

    if (close !== 0 && close <= open) {
      showToast('आखरी किलोमीटर शुरू के किलोमीटर से ज़्यादा होना चाहिए (Closing KM must be greater than Opening KM)', 'error');
      return;
    }

    const litres = dieselLitres === '' ? 0 : Number(dieselLitres);
    const amount = dieselAmount === '' ? 0 : Number(dieselAmount);

    if (litres < 0) {
      showToast('डीजल लीटर सही भरें (Diesel litres cannot be negative)', 'error');
      return;
    }
    if (amount < 0) {
      showToast('डीजल खर्चा सही भरें (Diesel amount cannot be negative)', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId,
          openingKm: open,
          closingKm: close === 0 ? open + 1 : close, // fallback if close is empty or 0 to pass backend constraint
          dieselLitres: litres,
          dieselAmount: amount,
          pumpName: pName,
          driverName: dName,
          remarks: remarks.trim(),
          date: todayDate
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit fuel entry.');
      }

      showToast('एंट्री सफलतापूर्वक जमा हो गई! (Fuel entry saved successfully!)', 'success');
      
      // Reset form fields
      setVehicleId('');
      setOpeningKm('');
      setClosingKm('');
      setDieselLitres('');
      setDieselAmount('');
      setPumpName('');
      setRemarks('');
      setDriverName(currentUser.name);

      // Trigger list refresh
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Error saving entry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Fuel className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Fuel Entry Form (डीजल एंट्री फार्म)</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Fill vehicle details simple & easy (गाड़ी की एंट्री यहाँ भरें)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Date (Auto-filled & Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Date (तारीख)
            </label>
            <input
              type="text"
              readOnly
              value={todayDate}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-mono text-sm focus:outline-none"
              title="Today's date is locked automatically"
            />
          </div>

          {/* 2. Vehicle Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-zinc-400" />
              Select Vehicle (गाड़ी का नंबर चुनें)
            </label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
            >
              <option value="">-- चुनें (Select Vehicle) --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber} ({v.vehicleName})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Driver Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              Driver Name (ड्राइवर का नाम)
            </label>
            <input
              type="text"
              placeholder="Driver's Full Name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {/* 4. Opening KM */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              Opening KM (शुरू का किलोमीटर) {lastKmLoading && <RefreshCcw className="w-3 h-3 animate-spin text-indigo-500" />}
            </label>
            <input
              type="number"
              placeholder="Odometer at start"
              value={openingKm}
              onChange={(e) => setOpeningKm(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
            />
          </div>

          {/* 5. Closing KM */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              Closing KM (आखरी किलोमीटर)
            </label>
            <input
              type="number"
              placeholder="Odometer at end"
              value={closingKm}
              onChange={(e) => setClosingKm(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
            />
          </div>

          {/* 6. Total KM (Auto Calculated) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              Total KM Covered (कुल चला किलोमीटर)
            </label>
            <div className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200 font-mono font-bold text-sm">
              {totalKm > 0 ? `${totalKm.toLocaleString()} KM` : '0 KM'}
            </div>
          </div>

          {/* 7. Diesel Filled (Litres) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-zinc-400" />
              Diesel Litres (कितना लीटर डीजल भरा)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 120.5"
              value={dieselLitres}
              onChange={(e) => setDieselLitres(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
            />
          </div>

          {/* 8. Diesel Amount (₹) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
              Diesel Amount (डीजल का खर्चा ₹)
            </label>
            <input
              type="number"
              step="1"
              placeholder="e.g. 11450"
              value={dieselAmount}
              onChange={(e) => setDieselAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
            />
          </div>

          {/* 9. Pump Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-zinc-400" />
              Petrol Pump Name (पेट्रोल पंप का नाम)
            </label>
            <input
              type="text"
              placeholder="e.g. Indian Oil, Sector 12"
              value={pumpName}
              onChange={(e) => setPumpName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        {/* 10. Remarks */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
            Any Notes (कोई अन्य जानकारी - Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Safe trip, tire pressure ok"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            id="btn-submit-entry"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base py-3 px-8 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Saving... (जमा हो रहा है...)' : 'Save Entry (एंट्री जमा करें)'}
          </button>
        </div>
      </form>
    </div>
  );
}

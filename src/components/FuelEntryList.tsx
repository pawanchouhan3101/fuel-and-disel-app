import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, Calendar, Filter, Edit2, X } from 'lucide-react';
import { FuelEntry, Vehicle, SafeUser, PaginationInfo } from '../types';

interface FuelEntryListProps {
  currentUser: SafeUser;
  vehicles: Vehicle[];
  usersList: SafeUser[]; // Needed for Admin dropdown filter
  token: string;
  refreshTrigger: number;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
  onRefreshStats: () => void;
}

export default function FuelEntryList({
  currentUser,
  vehicles,
  usersList,
  token,
  refreshTrigger,
  showToast,
  onRefreshStats
}: FuelEntryListProps) {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedUser, setSelectedUser] = useState(''); // Admin only
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editOpeningKm, setEditOpeningKm] = useState<number | ''>('');
  const [editClosingKm, setEditClosingKm] = useState<number | ''>('');
  const [editDieselLitres, setEditDieselLitres] = useState<number | ''>('');
  const [editDieselAmount, setEditDieselAmount] = useState<number | ''>('');
  const [editPumpName, setEditPumpName] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Fetch entries from Express Server
  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = `?page=${page}&limit=10`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (selectedMonth) query += `&month=${selectedMonth}`;
      if (selectedVehicle) query += `&vehicleId=${selectedVehicle}`;
      if (selectedUser && currentUser.role === 'Admin') query += `&userId=${selectedUser}`;
      if (startDate && endDate) query += `&startDate=${startDate}&endDate=${endDate}`;

      const res = await fetch(`/api/entries${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load logs');

      const body = await res.json();
      setEntries(body.data);
      setPagination(body.pagination);
    } catch (err: any) {
      showToast(err.message || 'Could not load fuel logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run on change of filters or triggers
  useEffect(() => {
    fetchEntries();
  }, [page, selectedMonth, selectedVehicle, selectedUser, startDate, endDate, refreshTrigger]);

  // Debounced/Triggered search helper
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEntries();
  };

  // Clear all filters
  const resetFilters = () => {
    setSearch('');
    setSelectedMonth('');
    setSelectedVehicle('');
    setSelectedUser('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Helper for excel download triggers
  const handleExcelDownload = (exportType: 'all' | 'monthly' | 'user') => {
    let query = `?exportType=${exportType}`;
    if (selectedMonth) query += `&month=${selectedMonth}`;
    if (selectedVehicle) query += `&vehicleId=${selectedVehicle}`;
    
    if (currentUser.role === 'User') {
      query += `&userId=${currentUser.id}`;
    } else {
      if (selectedUser) query += `&userId=${selectedUser}`;
    }

    // Direct window location update to trigger browser save attachment
    window.location.href = `/api/reports/excel${query}&authorization=${encodeURIComponent(token)}`;
    showToast('Starting Excel download...', 'success');
  };

  // Check if entry was created today
  const isCreatedToday = (entryDate: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return entryDate === todayStr;
  };

  // Handle Edit click
  const handleStartEdit = (entry: FuelEntry) => {
    setEditingEntry(entry);
    setEditVehicleId(entry.vehicleId);
    setEditOpeningKm(entry.openingKm);
    setEditClosingKm(entry.closingKm);
    setEditDieselLitres(entry.dieselLitres);
    setEditDieselAmount(entry.dieselAmount);
    setEditPumpName(entry.pumpName);
    setEditDriverName(entry.driverName);
    setEditRemarks(entry.remarks || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const dName = editDriverName.trim() || editingEntry.driverName || 'Driver';
    const pName = editPumpName.trim() || 'General Pump';

    const open = editOpeningKm === '' ? 0 : Number(editOpeningKm);
    const close = editClosingKm === '' ? 0 : Number(editClosingKm);

    if (close !== 0 && close <= open) {
      showToast('आखरी किलोमीटर शुरू के किलोमीटर से ज़्यादा होना चाहिए (Closing KM must be greater than Opening KM)', 'error');
      return;
    }

    const litres = editDieselLitres === '' ? 0 : Number(editDieselLitres);
    const amount = editDieselAmount === '' ? 0 : Number(editDieselAmount);

    if (litres < 0 || amount < 0) {
      showToast('लीटर और खर्चा सही भरें (Litres and Amount cannot be negative)', 'error');
      return;
    }

    setEditLoading(true);
    try {
      const response = await fetch(`/api/entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId: editVehicleId,
          openingKm: open,
          closingKm: close === 0 ? open + 1 : close,
          dieselLitres: litres,
          dieselAmount: amount,
          pumpName: pName,
          driverName: dName,
          remarks: editRemarks
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update entry');
      }

      showToast('लॉग सफलतापूर्वक बदल दिया गया! (Fuel log updated successfully!)', 'success');
      setEditingEntry(null);
      fetchEntries();
      onRefreshStats(); // Update totals cards
    } catch (err: any) {
      showToast(err.message || 'Error updating entry.', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-zinc-800 dark:text-zinc-200 font-bold text-sm">
          <Filter className="w-4 h-4 text-indigo-500" />
          Filter fuel entries
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Month Picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Select Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
            />
          </div>

          {/* 2. Vehicle Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Vehicle</label>
            <select
              value={selectedVehicle}
              onChange={(e) => {
                setSelectedVehicle(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
          </div>

          {/* 3. User Filter (Admin only) */}
          {currentUser.role === 'Admin' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Submitted By</label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="">All Users</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Search Keyword</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Driver, pump, remarks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-2" />
              </div>
            </div>
          )}

          {/* 4. Date Range Start */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
            />
          </div>

          {/* 5. Date Range End */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
            />
          </div>
        </form>

        {/* Action Buttons */}
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            {(search || selectedMonth || selectedVehicle || selectedUser || startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Excel Exports */}
          <div className="flex gap-2">
            {currentUser.role === 'Admin' ? (
              <>
                <button
                  onClick={() => handleExcelDownload('monthly')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 py-1.5 px-3 rounded-lg cursor-pointer transition-all"
                  title="Export currently filtered month"
                >
                  <Download className="w-3.5 h-3.5" />
                  Monthly Excel
                </button>
                {selectedUser && (
                  <button
                    onClick={() => handleExcelDownload('user')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 py-1.5 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    User-wise Excel
                  </button>
                )}
                <button
                  onClick={() => handleExcelDownload('all')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download All Logs
                </button>
              </>
            ) : (
              <button
                onClick={() => handleExcelDownload('monthly')}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-4 rounded-lg cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download Monthly Excel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Fetching fuel logs...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Calendar className="w-10 h-10 mx-auto text-zinc-300 mb-3" />
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">No logs matching filters</p>
            <p className="text-xs mt-1">Try resetting your filters or submitting a fuel log above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap lg:whitespace-normal">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-4 px-4 text-center w-12">SN</th>
                  <th className="py-4 px-4 w-28">Date</th>
                  {currentUser.role === 'Admin' && <th className="py-4 px-4">User</th>}
                  <th className="py-4 px-4">Vehicle</th>
                  <th className="py-4 px-4">Driver Name</th>
                  <th className="py-4 px-4 text-right">Odometer (KM)</th>
                  <th className="py-4 px-4 text-right">Total KM</th>
                  <th className="py-4 px-4 text-right">Diesel Filled</th>
                  <th className="py-4 px-4 text-right">Fuel Bill</th>
                  <th className="py-4 px-4">Pump Location</th>
                  <th className="py-4 px-4 max-w-xs">Remarks</th>
                  <th className="py-4 px-4 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {entries.map((e, index) => {
                  const sNumber = (pagination.page - 1) * pagination.limit + index + 1;
                  const canEdit = currentUser.role === 'Admin' || isCreatedToday(e.date);

                  return (
                    <tr key={e.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-zinc-400">{sNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        {new Date(e.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      {currentUser.role === 'Admin' && (
                        <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                          {e.userName}
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 rounded">
                          {e.vehicleNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300 font-medium">{e.driverName}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-500">
                        <div className="text-[10px] text-zinc-400">Open: {e.openingKm.toLocaleString()}</div>
                        <div className="font-semibold text-zinc-700 dark:text-zinc-300">Close: {e.closingKm.toLocaleString()}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">
                        {e.totalKm.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {e.dieselLitres} L
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{e.dieselAmount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 truncate max-w-xs" title={e.pumpName}>
                        {e.pumpName}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 italic max-w-xs truncate" title={e.remarks || ''}>
                        {e.remarks || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {canEdit ? (
                          <button
                            onClick={() => handleStartEdit(e)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors"
                            title="Edit fuel entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-300 dark:text-zinc-700" title="Lock period reached">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination footer */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing Page <b>{pagination.page}</b> of <b>{pagination.totalPages}</b> (Total {pagination.total} records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
                Edit Fuel Entry (एंट्री बदलें - {editingEntry.date})
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Select Vehicle (गाड़ी चुनें)
                  </label>
                  <select
                    value={editVehicleId}
                    onChange={(e) => setEditVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Driver Name (ड्राइवर का नाम)
                  </label>
                  <input
                    type="text"
                    value={editDriverName}
                    onChange={(e) => setEditDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Opening KM (शुरू का किलोमीटर)
                  </label>
                  <input
                    type="number"
                    value={editOpeningKm}
                    onChange={(e) => setEditOpeningKm(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Closing KM (आखरी किलोमीटर)
                  </label>
                  <input
                    type="number"
                    value={editClosingKm}
                    onChange={(e) => setEditClosingKm(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Diesel Litres (कितना लीटर डीजल भरा)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editDieselLitres}
                    onChange={(e) => setEditDieselLitres(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Diesel Amount (डीजल का खर्चा ₹)
                  </label>
                  <input
                    type="number"
                    value={editDieselAmount}
                    onChange={(e) => setEditDieselAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Petrol Pump Name (पेट्रोल पंप का नाम)
                </label>
                <input
                  type="text"
                  value={editPumpName}
                  onChange={(e) => setEditPumpName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Any Notes (कोई अन्य जानकारी)
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

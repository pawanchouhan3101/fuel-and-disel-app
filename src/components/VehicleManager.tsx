import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Check, CircleDot } from 'lucide-react';
import { Vehicle } from '../types';

interface VehicleManagerProps {
  vehicles: Vehicle[];
  token: string;
  onRefresh: () => void;
  showToast: (text: string, type: 'success' | 'error') => void;
}

export default function VehicleManager({ vehicles, token, onRefresh, showToast }: VehicleManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form states
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [loading, setLoading] = useState(false);

  const openAddModal = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setVehicleName('');
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleNumber(vehicle.vehicleNumber);
    setVehicleName(vehicle.vehicleName);
    setStatus(vehicle.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim() || !vehicleName.trim()) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    setLoading(true);
    const url = editingVehicle ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles';
    const method = editingVehicle ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleName: vehicleName.trim(),
          status
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save vehicle');
      }

      showToast(editingVehicle ? 'Vehicle details updated successfully.' : 'New vehicle added to fleet.', 'success');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'An error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!confirm(`Are you sure you want to delete ${vehicle.vehicleNumber} (${vehicle.vehicleName})?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete vehicle');
      }

      showToast(result.message || 'Vehicle record deleted successfully.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'An error occurred.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Vehicle Management</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Register, update, or disable vehicles in your fleet</p>
        </div>
        <button
          onClick={openAddModal}
          id="btn-add-vehicle"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {/* Grid or Table of Vehicles */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <CircleDot className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">No vehicles registered</p>
            <p className="text-xs mt-1">Get started by adding your first vehicle to the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Vehicle Number</th>
                  <th className="py-4 px-6">Vehicle Name</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md text-zinc-900 dark:text-zinc-100">
                        {v.vehicleNumber}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-zinc-700 dark:text-zinc-300 font-medium">
                      {v.vehicleName}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          v.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {v.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(v)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit Vehicle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Delete Vehicle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">
                {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MH-12-QW-1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Vehicle Name / Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tata Prima Truck (Heavy Duty)"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={status === 'Active'}
                      onChange={() => setStatus('Active')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Active (Visible for fuel logging)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={status === 'Inactive'}
                      onChange={() => setStatus('Inactive')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Inactive
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

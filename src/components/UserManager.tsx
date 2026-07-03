import React, { useState } from 'react';
import { Plus, Edit2, Lock, X, Shield, Mail, Phone, User as UserIcon } from 'lucide-react';
import { SafeUser } from '../types';

interface UserManagerProps {
  users: SafeUser[];
  token: string;
  onRefresh: () => void;
  showToast: (text: string, type: 'success' | 'error') => void;
}

export default function UserManager({ users, token, onRefresh, showToast }: UserManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<SafeUser | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'User'>('User');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setRole('User');
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (user: SafeUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setMobile(user.mobile);
    setRole(user.role);
    setStatus(user.status);
    setPassword(''); // No password input on general edit
    setIsModalOpen(true);
  };

  const openResetModal = (user: SafeUser) => {
    setResetTargetUser(user);
    setNewPassword('');
    setIsResetModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !mobile.trim() || (!editingUser && !password.trim())) {
      showToast('Please fill in all mandatory fields.', 'error');
      return;
    }

    setLoading(true);
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          role,
          status,
          password: password.trim() // Only used during creation
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save user');
      }

      showToast(editingUser ? 'User profile updated successfully.' : 'New user created successfully.', 'success');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'An error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword.trim() || newPassword.trim().length < 4) {
      showToast('Password must be at least 4 characters long.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${resetTargetUser.id}/reset-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword.trim() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      showToast(`Password updated for ${resetTargetUser.name}.`, 'success');
      setIsResetModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'An error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">User Management</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Control login permissions, assign roles, or reset passwords</p>
        </div>
        <button
          onClick={openAddModal}
          id="btn-add-user"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <UserIcon className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-4 px-6">User details</th>
                  <th className="py-4 px-6">Mobile</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          {u.name}
                          {u.role === 'Admin' && (
                            <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              Admin
                            </span>
                          )}
                        </span>
                        <span className="text-zinc-400 text-xs mt-0.5 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {u.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-zinc-600 dark:text-zinc-300 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        {u.mobile}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {u.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(u)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openResetModal(u)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-amber-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Reset Password"
                      >
                        <Lock className="w-4 h-4" />
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
                {editingUser ? 'Edit User' : 'Add User'}
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
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="10 digit mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    placeholder="At least 4 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'Admin' | 'User')}
                    className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-zinc-900"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-zinc-900"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Disabled</option>
                  </select>
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
                  {loading ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isResetModalOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-md text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" />
                Reset Password
              </h3>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Set a new password for <span className="font-semibold text-zinc-800 dark:text-zinc-200">{resetTargetUser.name}</span> ({resetTargetUser.email}).
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  placeholder="Min 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

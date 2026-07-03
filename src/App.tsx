import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Fuel,
  Truck,
  Users,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Gauge,
  CreditCard,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SafeUser, Vehicle, ActiveTab, DashboardTotals } from './types';
import ToastContainer, { ToastMessage } from './components/Toast';
import SVGCharts from './components/SVGCharts';
import VehicleManager from './components/VehicleManager';
import UserManager from './components/UserManager';
import FuelEntryForm from './components/FuelEntryForm';
import FuelEntryList from './components/FuelEntryList';

export default function App() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  // App navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Core system entity caches
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardTotals>({
    totalKm: 0,
    totalLitres: 0,
    totalAmount: 0,
    totalEntries: 0
  });

  // Data update trigger counters
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dbStatus, setDbStatus] = useState<{ type: string; connected: boolean; message: string } | null>(null);

  // Fetch DB Connection Status on load and when trigger updates
  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        const res = await fetch('/api/db-status');
        if (res.ok) {
          const data = await res.json();
          setDbStatus(data);
        }
      } catch (e) {
        console.error('Error fetching database status:', e);
      }
    };
    fetchDbStatus();
  }, [refreshTrigger]);

  // Feedback states
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToasts((prev) => [...prev, { id: `${Date.now()}`, type, text }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial Authentication & Session Restoration
  useEffect(() => {
    // Check dark mode preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const savedToken = localStorage.getItem('fuel_token');
    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (res.ok) {
          const user = await res.json();
          setToken(savedToken);
          setCurrentUser(user);
        } else {
          localStorage.removeItem('fuel_token');
        }
      } catch (e) {
        console.error('Session check failed:', e);
      } finally {
        setAuthChecking(false);
      }
    };

    verifySession();
  }, []);

  // 2. Fetch Global Lists (Vehicles, Users, Stats) when authenticated
  const loadSystemData = async () => {
    if (!token) return;

    try {
      // Fetch Active/All Vehicles depending on role (handled by backend GET /api/vehicles)
      const vehRes = await fetch('/api/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vehRes.ok) {
        const data = await vehRes.json();
        setVehicles(data);
      }

      // If Admin, also fetch All Users
      if (currentUser?.role === 'Admin') {
        const usersRes = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsersList(data);
        }
      }

      // Fetch dashboard totals/entries stats
      const entriesRes = await fetch('/api/entries?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (entriesRes.ok) {
        const body = await entriesRes.json();
        if (body.totals) {
          setDashboardStats(body.totals);
        }
      }
    } catch (err) {
      console.error('Error fetching global system states:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadSystemData();
    }
  }, [currentUser, token, refreshTrigger]);

  // Dark Mode toggle helper
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // Login Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please verify credentials.');
      }

      localStorage.setItem('fuel_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      showToast(`Welcome back, ${data.user.name}!`, 'success');
      
      // Reset forms
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Server connection error.');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // Sign out helper
  const handleLogout = () => {
    localStorage.removeItem('fuel_token');
    setCurrentUser(null);
    setToken(null);
    setActiveTab('dashboard');
    showToast('Logged out successfully.', 'info');
  };

  // Custom refresh stats helper
  const handleRefreshStatsOnly = async () => {
    if (!token) return;
    try {
      const entriesRes = await fetch('/api/entries?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (entriesRes.ok) {
        const body = await entriesRes.json();
        if (body.totals) {
          setDashboardStats(body.totals);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEntrySubmitSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    handleRefreshStatsOnly();
  };

  // 3. Loading Initial Auth Spinner
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase animate-pulse">
            Verifying secure session...
          </p>
        </div>
      </div>
    );
  }

  // 4. Login Form View
  if (!currentUser || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 transition-colors font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
        {/* Decorative ambient background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-8 shadow-xl relative z-10">
          <div className="text-center space-y-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Fuel className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Fuel Management
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sign in to log fuel, manage fleet details, or view reports
            </p>
            {dbStatus && (
              <div className="pt-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  dbStatus.connected 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' 
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {dbStatus.type === 'mongodb' ? 'MongoDB Cloud Active' : 'Local File Storage Active'}
                </span>
              </div>
            )}
            {dbStatus && dbStatus.message && dbStatus.message.includes('IP_ACCESS_BLOCKED') && (
              <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs space-y-1.5 text-left leading-relaxed">
                <p className="font-bold flex items-center gap-1">
                  ⚠️ MongoDB IP Blocked
                </p>
                <p className="text-[11px] opacity-90">
                  Your MongoDB Atlas cluster rejected the connection. Since this app runs in a secure cloud sandbox with dynamic IPs, please follow these steps:
                </p>
                <ol className="list-decimal pl-4 text-[10px] space-y-0.5 opacity-90 font-mono">
                  <li>Go to <strong className="underline">cloud.mongodb.com</strong></li>
                  <li>Click <strong>Network Access</strong> (under Security)</li>
                  <li>Click <strong>Add IP Address</strong></li>
                  <li>Enter <strong>0.0.0.0/0</strong> (Allow access from anywhere) and save</li>
                </ol>
                <p className="text-[10px] opacity-75 italic pt-1">
                  Note: App is currently running safely on local JSON storage backup.
                </p>
              </div>
            )}
            {dbStatus && dbStatus.message && dbStatus.message.includes('MONGODB_AUTH_FAILED') && (
              <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 rounded-xl text-xs space-y-1.5 text-left leading-relaxed">
                <p className="font-bold flex items-center gap-1">
                  ❌ MongoDB Auth Failed
                </p>
                <p className="text-[11px] opacity-90">
                  The password or username in your <strong>MONGODB_URI</strong> is incorrect.
                </p>
                <ul className="list-disc pl-4 text-[10px] space-y-0.5 opacity-90 font-mono">
                  <li>Go to Settings (top-right of AI Studio)</li>
                  <li>Update <strong>MONGODB_URI</strong> with the correct username/password</li>
                  <li>Verify password doesn't contain unencoded special chars (e.g. <code>@</code> or <code>:</code> should be URL encoded as <code>%40</code> or <code>%3A</code>)</li>
                </ul>
                <p className="text-[10px] opacity-75 italic pt-1">
                  Note: Operating safely on local JSON storage backup.
                </p>
              </div>
            )}
            {dbStatus && dbStatus.message && dbStatus.message.includes('MONGODB_PLACEHOLDERS_DETECTED') && (
              <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs space-y-1.5 text-left leading-relaxed">
                <p className="font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  ⚠️ Placeholders in Connection String
                </p>
                <p className="text-[11px] opacity-90">
                  Your <strong>MONGODB_URI</strong> contains literal placeholder tags like <code>&lt;db_username&gt;</code> or <code>&lt;db_password&gt;</code>.
                </p>
                <ul className="list-disc pl-4 text-[10px] space-y-0.5 opacity-90 font-mono">
                  <li>Go to Settings (top-right gear icon)</li>
                  <li>Edit <strong>MONGODB_URI</strong></li>
                  <li>Replace the <code>&lt;...&gt;</code> tags with your actual MongoDB Atlas database user username and password (remove the angle brackets entirely).</li>
                </ul>
                <p className="text-[10px] opacity-75 italic pt-1">
                  Note: Operating safely on local JSON storage backup.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 rounded-xl text-xs font-medium">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="driver@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-transparent text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              id="btn-login-submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Seed credentials assistance guide */}
          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-400">
            <p className="font-semibold text-zinc-500 dark:text-zinc-300 mb-2">Seed accounts helper:</p>
            <div className="grid grid-cols-2 gap-3 text-left font-mono text-[10px] bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
              <div>
                <p className="font-bold text-indigo-600 dark:text-indigo-400">Admin Account</p>
                <p>E: admin@fuel.com</p>
                <p>P: admin123</p>
              </div>
              <div>
                <p className="font-bold text-indigo-600 dark:text-indigo-400">Driver Account</p>
                <p>E: user@fuel.com</p>
                <p>P: user123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Authenticated App Layout with Sidebar and Navbar
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans transition-colors flex">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* --- SIDEBAR --- */}
      {/* Sidebar background overlay for mobile screens */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800/80 z-40 transform lg:transform-none lg:static transition-transform duration-300 flex flex-col justify-between ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Brand header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Fuel className="w-4.5 h-4.5" />
              </div>
              <span className="font-bold text-base text-zinc-900 dark:text-zinc-50 tracking-tight">
                FuelManager
              </span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              Dashboard
            </button>

            {/* Admin only: Vehicle registration */}
            {currentUser.role === 'Admin' && (
              <button
                onClick={() => {
                  setActiveTab('vehicles');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'vehicles'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Truck className="w-4.5 h-4.5" />
                Fleet Vehicles
              </button>
            )}

            {/* Admin only: User management */}
            {currentUser.role === 'Admin' && (
              <button
                onClick={() => {
                  setActiveTab('users');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                User Accounts
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar user footer info & Signout */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-zinc-400 font-semibold truncate uppercase tracking-wider">
                {currentUser.role} Account
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            id="btn-logout"
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 py-2 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* --- MAIN PAGE WORKSPACE --- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar Header */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/80 px-6 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight capitalize">
              {activeTab === 'dashboard' ? `${currentUser.role} Dashboard` : activeTab === 'vehicles' ? 'Fleet Management' : 'System Users'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick database connection and fleet indicators */}
            {dbStatus && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className={dbStatus.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {dbStatus.type === 'mongodb' ? 'MongoDB' : 'Local File'}
                </span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Fleet Online</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-300 transition-colors cursor-pointer"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* Main Content scroll window */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* MongoDB IP Access blocked alert */}
                {dbStatus && dbStatus.message && dbStatus.message.includes('IP_ACCESS_BLOCKED') && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl text-xs space-y-2 relative overflow-hidden shadow-sm">
                    <p className="font-bold flex items-center gap-1 text-sm">
                      ⚠️ MongoDB Connection Blocked by IP Restrictions
                    </p>
                    <p className="opacity-90 leading-relaxed max-w-3xl">
                      The application's connection to MongoDB was rejected because your MongoDB Atlas Network Access rules do not authorize this cloud server. Since the application runs in a dynamic, containerized cloud sandbox, please log in to your MongoDB Atlas dashboard and allow access from all IPs:
                    </p>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 w-fit">
                      <div>1. Go to <strong className="underline">cloud.mongodb.com</strong></div>
                      <div>2. Click <strong>Network Access</strong></div>
                      <div>3. Click <strong>Add IP Address</strong></div>
                      <div>4. Enter <strong>0.0.0.0/0</strong> (Anywhere)</div>
                    </div>
                    <p className="text-[10px] opacity-75 italic">
                      💡 The app is currently operating normally in local-fallback mode using <span className="font-mono">db.json</span>. Once you authorize <span className="font-mono">0.0.0.0/0</span>, MongoDB will connect automatically on the next server reboot or refresh.
                    </p>
                  </div>
                )}

                {/* MongoDB Authentication failed alert */}
                {dbStatus && dbStatus.message && dbStatus.message.includes('MONGODB_AUTH_FAILED') && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 rounded-2xl text-xs space-y-2 relative overflow-hidden shadow-sm">
                    <p className="font-bold flex items-center gap-1 text-sm">
                      ❌ MongoDB Authentication Failed (Bad Credentials)
                    </p>
                    <p className="opacity-90 leading-relaxed max-w-3xl">
                      The connection to MongoDB failed because the credentials in your <strong>MONGODB_URI</strong> are incorrect. Please verify that your MongoDB username and password are correct:
                    </p>
                    <div className="flex flex-col gap-1.5 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 w-fit max-w-full">
                      <div>• Check that the database username and password in the connection string match a registered <strong>Database User</strong> in MongoDB Atlas.</div>
                      <div>• If your password contains special characters like <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">@</code>, <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">:</code>, or <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">/</code>, they must be URL encoded (e.g. <code>@</code> becomes <code>%40</code>).</div>
                    </div>
                    <p className="text-[10px] opacity-75 italic">
                      💡 The app is currently operating normally in local-fallback mode using <span className="font-mono">db.json</span>. Update the connection string under the <strong>Settings</strong> gear icon (top-right) and reboot to retry.
                    </p>
                  </div>
                )}

                {/* MongoDB Placeholder warning alert */}
                {dbStatus && dbStatus.message && dbStatus.message.includes('MONGODB_PLACEHOLDERS_DETECTED') && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl text-xs space-y-2 relative overflow-hidden shadow-sm">
                    <p className="font-bold flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                      ⚠️ MONGODB_URI Connection String Contains Placeholders
                    </p>
                    <p className="opacity-90 leading-relaxed max-w-3xl">
                      Your <strong>MONGODB_URI</strong> currently contains placeholder tokens such as <code>&lt;db_username&gt;</code> or <code>&lt;db_password&gt;</code> instead of your actual database user account credentials.
                    </p>
                    <div className="flex flex-col gap-1.5 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 w-fit max-w-full">
                      <div>• Go to the <strong>Settings</strong> menu (top-right gear icon in AI Studio) and check your MONGODB_URI secret.</div>
                      <div>• Replace the bracketed text (including the <code>&lt;</code> and <code>&gt;</code> characters themselves) with your actual database user name and password that you created in MongoDB Atlas.</div>
                    </div>
                    <p className="text-[10px] opacity-75 italic">
                      💡 The app is operating normally in local-fallback mode using <span className="font-mono">db.json</span>. Change the value in Settings and reboot to reconnect.
                    </p>
                  </div>
                )}

                {/* 1. Metric Cards Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Diesel filled */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Fuel className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Diesel Filled</p>
                      <h4 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                        {dashboardStats.totalLitres.toLocaleString()} L
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-semibold">Across all records</p>
                    </div>
                  </div>

                  {/* Card 2: Total KM traveled */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Gauge className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Fleet KM</p>
                      <h4 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                        {dashboardStats.totalKm.toLocaleString()} KM
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-semibold">Calculated mileage range</p>
                    </div>
                  </div>

                  {/* Card 3: Total Entries */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Fuel Logs</p>
                      <h4 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                        {dashboardStats.totalEntries} Entries
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-semibold">Active logs submitted</p>
                    </div>
                  </div>

                  {/* Card 4: Monthly Summary (Expenditure ₹) */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Spent (₹)</p>
                      <h4 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{dashboardStats.totalAmount.toLocaleString()}
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-semibold">Cumulative financial bill</p>
                    </div>
                  </div>
                </div>

                {/* 2. Admin charts dashboard summary */}
                {currentUser.role === 'Admin' && (
                  <SVGCharts entries={dashboardStats.totalEntries > 0 ? vehicles.reduce((acc: any, v) => acc, []) : []} vehicles={vehicles} />
                )}

                {/* 3. Fuel entry creation form */}
                <FuelEntryForm
                  vehicles={vehicles}
                  currentUser={currentUser}
                  token={token}
                  onSuccess={handleEntrySubmitSuccess}
                  showToast={showToast}
                />

                {/* 4. Table logs list */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Fuel Submission Logs</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Explore historic odometer, diesel details, and filter reports</p>
                  </div>

                  <FuelEntryList
                    currentUser={currentUser}
                    vehicles={vehicles}
                    usersList={usersList}
                    token={token}
                    refreshTrigger={refreshTrigger}
                    showToast={showToast}
                    onRefreshStats={handleRefreshStatsOnly}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'vehicles' && currentUser.role === 'Admin' && (
              <motion.div
                key="vehicles"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <VehicleManager
                  vehicles={vehicles}
                  token={token}
                  onRefresh={loadSystemData}
                  showToast={showToast}
                />
              </motion.div>
            )}

            {activeTab === 'users' && currentUser.role === 'Admin' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <UserManager
                  users={usersList}
                  token={token}
                  onRefresh={loadSystemData}
                  showToast={showToast}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

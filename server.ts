import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { getDb, updateDb, User, Vehicle, FuelEntry, getDbStatus } from './src/db/db.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// API DB status endpoint (publicly accessible or auth-optional)
app.get('/api/db-status', (req, res) => {
  res.json(getDbStatus());
});

// Token-based authentication middleware (Hybrid Header + Cookie support)
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

function parseToken(req: express.Request): { id: string; role: string } | null {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fallback to cookie
      const cookies = req.headers.cookie || '';
      const tokenMatch = cookies.match(/fuel_session=([^;]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
    }

    if (!token) return null;

    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (decoded && decoded.id && decoded.role) {
      return decoded;
    }
  } catch (e) {
    // Invalid token format
  }
  return null;
}

// Authentication Guard
const requireAuth = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const tokenData = parseToken(req);
  if (!tokenData) {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
    return;
  }

  const db = getDb();
  const user = db.users.find(u => u.id === tokenData.id);

  if (!user) {
    res.status(401).json({ error: 'User session expired or user not found.' });
    return;
  }

  if (user.status !== 'Active') {
    res.status(403).json({ error: 'Your account has been disabled or is inactive.' });
    return;
  }

  req.user = user;
  next();
};

// Admin Guard
const requireAdmin = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }
    next();
  });
};

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const db = getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || user.passwordHash !== password) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.status !== 'Active') {
    res.status(403).json({ error: 'Your account is currently disabled. Contact administrator.' });
    return;
  }

  // Generate Base64 Session Token
  const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role })).toString('base64');

  // Set HTTP-only Cookie for safety (optional fallback, expires in 7 days)
  res.setHeader(
    'Set-Cookie',
    `fuel_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );

  const { passwordHash, ...safeUser } = user;
  res.json({
    token,
    user: safeUser
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    const { passwordHash, ...safeUser } = req.user;
    res.json(safeUser);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// --- VEHICLE ENDPOINTS ---

app.get('/api/vehicles', requireAuth, (req, res) => {
  const db = getDb();
  // Normal users only see Active vehicles for the dropdown
  // Admin sees all for management
  const tokenData = parseToken(req);
  if (tokenData && tokenData.role === 'Admin') {
    res.json(db.vehicles);
  } else {
    res.json(db.vehicles.filter(v => v.status === 'Active'));
  }
});

app.post('/api/vehicles', requireAdmin, (req, res) => {
  const { vehicleNumber, vehicleName, status } = req.body;

  if (!vehicleNumber || !vehicleName) {
    res.status(400).json({ error: 'Vehicle number and name are required.' });
    return;
  }

  const normalizedNumber = vehicleNumber.toUpperCase().trim();

  let exists = false;
  updateDb(db => {
    const duplicate = db.vehicles.find(v => v.vehicleNumber.toUpperCase() === normalizedNumber);
    if (duplicate) {
      exists = true;
      return;
    }

    const newVehicle: Vehicle = {
      id: `v_${Date.now()}`,
      vehicleNumber: normalizedNumber,
      vehicleName: vehicleName.trim(),
      status: status === 'Inactive' ? 'Inactive' : 'Active'
    };

    db.vehicles.push(newVehicle);
  });

  if (exists) {
    res.status(400).json({ error: 'A vehicle with this number already exists.' });
  } else {
    res.json({ success: true, message: 'Vehicle added successfully' });
  }
});

app.put('/api/vehicles/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { vehicleNumber, vehicleName, status } = req.body;

  if (!vehicleNumber || !vehicleName) {
    res.status(400).json({ error: 'Vehicle number and name are required.' });
    return;
  }

  const normalizedNumber = vehicleNumber.toUpperCase().trim();
  let duplicateFound = false;
  let found = false;

  updateDb(db => {
    const vehicle = db.vehicles.find(v => v.id === id);
    if (!vehicle) return;
    found = true;

    const duplicate = db.vehicles.find(v => v.id !== id && v.vehicleNumber.toUpperCase() === normalizedNumber);
    if (duplicate) {
      duplicateFound = true;
      return;
    }

    vehicle.vehicleNumber = normalizedNumber;
    vehicle.vehicleName = vehicleName.trim();
    vehicle.status = status === 'Inactive' ? 'Inactive' : 'Active';
  });

  if (!found) {
    res.status(404).json({ error: 'Vehicle not found' });
  } else if (duplicateFound) {
    res.status(400).json({ error: 'Another vehicle with this number already exists.' });
  } else {
    res.json({ success: true, message: 'Vehicle updated successfully' });
  }
});

app.delete('/api/vehicles/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let hasEntries = false;
  let deleted = false;

  const db = getDb();
  if (db.entries.some(e => e.vehicleId === id)) {
    hasEntries = true;
  }

  if (hasEntries) {
    // Soft delete by setting inactive
    updateDb(db => {
      const v = db.vehicles.find(v => v.id === id);
      if (v) {
        v.status = 'Inactive';
        deleted = true;
      }
    });
    res.json({
      success: true,
      message: 'Vehicle has existing fuel entries. It has been marked as Inactive instead of fully deleted to preserve data integrity.'
    });
    return;
  }

  updateDb(db => {
    const index = db.vehicles.findIndex(v => v.id === id);
    if (index !== -1) {
      db.vehicles.splice(index, 1);
      deleted = true;
    }
  });

  if (deleted) {
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } else {
    res.status(404).json({ error: 'Vehicle not found' });
  }
});

// --- USER MANAGEMENT ENDPOINTS ---

app.get('/api/users', requireAdmin, (req, res) => {
  const db = getDb();
  const safeUsers = db.users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { name, email, mobile, password, role, status } = req.body;

  if (!name || !email || !mobile || !password || !role) {
    res.status(400).json({ error: 'All fields (Name, Email, Mobile, Password, Role) are mandatory.' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  let emailExists = false;

  updateDb(db => {
    const duplicate = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (duplicate) {
      emailExists = true;
      return;
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      passwordHash: password,
      role: role === 'Admin' ? 'Admin' : 'User',
      status: status === 'Inactive' ? 'Inactive' : 'Active'
    };

    db.users.push(newUser);
  });

  if (emailExists) {
    res.status(400).json({ error: 'A user with this email address already exists.' });
  } else {
    res.json({ success: true, message: 'User added successfully' });
  }
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, role, status } = req.body;

  if (!name || !email || !mobile || !role) {
    res.status(400).json({ error: 'Name, Email, Mobile and Role are mandatory.' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  let emailExists = false;
  let found = false;

  updateDb(db => {
    const u = db.users.find(user => user.id === id);
    if (!u) return;
    found = true;

    const duplicate = db.users.find(user => user.id !== id && user.email.toLowerCase() === normalizedEmail);
    if (duplicate) {
      emailExists = true;
      return;
    }

    u.name = name.trim();
    u.email = normalizedEmail;
    u.mobile = mobile.trim();
    u.role = role === 'Admin' ? 'Admin' : 'User';
    u.status = status === 'Inactive' ? 'Inactive' : 'Active';
  });

  if (!found) {
    res.status(404).json({ error: 'User not found' });
  } else if (emailExists) {
    res.status(400).json({ error: 'Another user is already registered with this email.' });
  } else {
    res.json({ success: true, message: 'User updated successfully' });
  }
});

app.patch('/api/users/:id/reset-password', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    return;
  }

  let found = false;
  updateDb(db => {
    const u = db.users.find(user => user.id === id);
    if (u) {
      u.passwordHash = password;
      found = true;
    }
  });

  if (found) {
    res.json({ success: true, message: 'Password reset successfully' });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// --- FUEL ENTRY ENDPOINTS ---

app.get('/api/entries', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  let entries = [...db.entries];

  // If normal user, filter to only their entries
  if (user.role === 'User') {
    entries = entries.filter(e => e.userId === user.id);
  } else {
    // Admins can filter by user
    const filterUser = req.query.userId as string;
    if (filterUser) {
      entries = entries.filter(e => e.userId === filterUser);
    }
  }

  // Common filters
  const month = req.query.month as string; // YYYY-MM
  if (month) {
    entries = entries.filter(e => e.date.startsWith(month));
  }

  const vehicleId = req.query.vehicleId as string;
  if (vehicleId) {
    entries = entries.filter(e => e.vehicleId === vehicleId);
  }

  const exactDate = req.query.date as string; // YYYY-MM-DD
  if (exactDate) {
    entries = entries.filter(e => e.date === exactDate);
  }

  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  if (startDate && endDate) {
    entries = entries.filter(e => e.date >= startDate && e.date <= endDate);
  }

  const search = (req.query.search as string || '').toLowerCase().trim();
  if (search) {
    entries = entries.filter(e => {
      const v = db.vehicles.find(veh => veh.id === e.vehicleId);
      const u = db.users.find(usr => usr.id === e.userId);
      return (
        e.driverName.toLowerCase().includes(search) ||
        e.pumpName.toLowerCase().includes(search) ||
        (e.remarks || '').toLowerCase().includes(search) ||
        (v?.vehicleNumber || '').toLowerCase().includes(search) ||
        (u?.name || '').toLowerCase().includes(search)
      );
    });
  }

  // Sort by date descending (latest first) by default
  entries.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Calculate stats before pagination (so we return totals for dashboard)
  let totalKmSum = 0;
  let totalLitresSum = 0;
  let totalAmountSum = 0;
  entries.forEach(e => {
    totalKmSum += e.totalKm;
    totalLitresSum += e.dieselLitres;
    totalAmountSum += e.dieselAmount;
  });

  // Pagination
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '10', 10);
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const paginatedEntries = entries.slice(startIndex, endIndex);

  // Map entries with User/Vehicle info for displaying names
  const enrichedEntries = paginatedEntries.map(e => {
    const v = db.vehicles.find(veh => veh.id === e.vehicleId);
    const u = db.users.find(usr => usr.id === e.userId);
    return {
      ...e,
      vehicleNumber: v?.vehicleNumber || 'Deleted Vehicle',
      vehicleName: v?.vehicleName || '',
      userName: u?.name || 'Deleted User'
    };
  });

  res.json({
    data: enrichedEntries,
    pagination: {
      total: entries.length,
      page,
      limit,
      totalPages: Math.ceil(entries.length / limit)
    },
    totals: {
      totalKm: totalKmSum,
      totalLitres: totalLitresSum,
      totalAmount: totalAmountSum,
      totalEntries: entries.length
    }
  });
});

// Helper to get last reading of a vehicle for opening KM suggestions!
app.get('/api/vehicles/:vehicleId/last-km', requireAuth, (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  // Find entries for this vehicle sorted by date and closingKm descending
  const vehicleEntries = db.entries
    .filter(e => e.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.closingKm - a.closingKm);

  if (vehicleEntries.length > 0) {
    res.json({ lastClosingKm: vehicleEntries[0].closingKm });
  } else {
    res.json({ lastClosingKm: 0 });
  }
});

// Submit daily entry
app.post('/api/entries', requireAuth, (req: AuthenticatedRequest, res) => {
  const {
    vehicleId,
    openingKm,
    closingKm,
    dieselLitres,
    dieselAmount,
    pumpName,
    driverName,
    remarks,
    date
  } = req.body;

  const user = req.user!;

  // 1. Mandatory checks
  if (!vehicleId || !driverName || !pumpName) {
    res.status(400).json({ error: 'Vehicle, Driver Name, and Pump Name are mandatory.' });
    return;
  }

  // 2. KM constraints
  const open = Number(openingKm);
  const close = Number(closingKm);
  if (isNaN(open) || isNaN(close) || close <= open) {
    res.status(400).json({ error: 'Closing KM must be strictly greater than Opening KM.' });
    return;
  }

  // 3. Litres & Amount constraints
  const litres = Number(dieselLitres);
  const amount = Number(dieselAmount);
  if (isNaN(litres) || litres < 0) {
    res.status(400).json({ error: 'Diesel litres cannot be negative.' });
    return;
  }
  if (isNaN(amount) || amount < 0) {
    res.status(400).json({ error: 'Diesel amount cannot be negative.' });
    return;
  }

  // 4. Date selection (Defaults to today in YYYY-MM-DD)
  // We use server timezone formatted YYYY-MM-DD, or user supplied validated date
  const entryDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0];

  const db = getDb();

  // 5. Pre-flight check: Prevent duplicate entry for same user, vehicle and date
  const isDuplicate = db.entries.some(e =>
    e.userId === user.id &&
    e.vehicleId === vehicleId &&
    e.date === entryDate
  );

  if (isDuplicate) {
    res.status(400).json({ error: 'Duplicate entry detected! You have already submitted a fuel log for this vehicle on this date.' });
    return;
  }

  const newEntry: FuelEntry = {
    id: `e_${Date.now()}`,
    userId: user.id,
    vehicleId,
    date: entryDate,
    openingKm: open,
    closingKm: close,
    totalKm: close - open,
    dieselLitres: litres,
    dieselAmount: amount,
    pumpName: pumpName.trim(),
    driverName: driverName.trim(),
    remarks: remarks ? remarks.trim() : undefined,
    createdAt: new Date().toISOString()
  };

  updateDb(db => {
    db.entries.push(newEntry);
  });

  const v = db.vehicles.find(veh => veh.id === vehicleId);

  res.json({
    success: true,
    message: 'Fuel entry saved successfully!',
    data: {
      ...newEntry,
      vehicleNumber: v?.vehicleNumber || 'Unknown',
      vehicleName: v?.vehicleName || '',
      userName: user.name
    }
  });
});

// Edit/update today's entry
app.put('/api/entries/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const {
    vehicleId,
    openingKm,
    closingKm,
    dieselLitres,
    dieselAmount,
    pumpName,
    driverName,
    remarks
  } = req.body;

  const user = req.user!;
  const todayStr = new Date().toISOString().split('T')[0];

  let found = false;
  let notAuthorized = false;
  let notToday = false;
  let validationError = '';

  updateDb(db => {
    const entry = db.entries.find(e => e.id === id);
    if (!entry) return;
    found = true;

    // Normal user check: can only edit own record
    if (user.role === 'User' && entry.userId !== user.id) {
      notAuthorized = true;
      return;
    }

    // Normal user check: can only edit TODAY'S entries
    if (user.role === 'User' && entry.date !== todayStr) {
      notToday = true;
      return;
    }

    // Validation
    const open = Number(openingKm);
    const close = Number(closingKm);
    if (isNaN(open) || isNaN(close) || close <= open) {
      validationError = 'Closing KM must be strictly greater than Opening KM.';
      return;
    }

    const litres = Number(dieselLitres);
    const amount = Number(dieselAmount);
    if (isNaN(litres) || litres < 0) {
      validationError = 'Diesel litres cannot be negative.';
      return;
    }
    if (isNaN(amount) || amount < 0) {
      validationError = 'Diesel amount cannot be negative.';
      return;
    }

    if (!vehicleId || !driverName || !pumpName) {
      validationError = 'Vehicle, Driver Name, and Pump Name are mandatory.';
      return;
    }

    // Apply updates
    entry.vehicleId = vehicleId;
    entry.openingKm = open;
    entry.closingKm = close;
    entry.totalKm = close - open;
    entry.dieselLitres = litres;
    entry.dieselAmount = amount;
    entry.pumpName = pumpName.trim();
    entry.driverName = driverName.trim();
    entry.remarks = remarks ? remarks.trim() : undefined;
  });

  if (!found) {
    res.status(404).json({ error: 'Fuel entry not found.' });
  } else if (notAuthorized) {
    res.status(403).json({ error: 'You are not authorized to edit this entry.' });
  } else if (notToday) {
    res.status(403).json({ error: 'Lock-out period reached. Users can only edit entries submitted today.' });
  } else if (validationError) {
    res.status(400).json({ error: validationError });
  } else {
    res.json({ success: true, message: 'Fuel entry updated successfully.' });
  }
});

// --- EXCEL REPORT EXPORT ENDPOINT ---

app.get('/api/reports/excel', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = getDb();

  let entries = [...db.entries];

  // If normal user, enforce their userId only
  if (user.role === 'User') {
    entries = entries.filter(e => e.userId === user.id);
  } else {
    // Admin can filter by user
    const filterUser = req.query.userId as string;
    if (filterUser) {
      entries = entries.filter(e => e.userId === filterUser);
    }
  }

  // Filters
  const month = req.query.month as string; // YYYY-MM
  if (month) {
    entries = entries.filter(e => e.date.startsWith(month));
  }

  const vehicleId = req.query.vehicleId as string;
  if (vehicleId) {
    entries = entries.filter(e => e.vehicleId === vehicleId);
  }

  const exportType = req.query.exportType as string || 'all'; // monthly, user, all

  // Sort entries chronologically for the Excel report (oldest first or newest first - usually oldest first for reports!)
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // Map to clean format for spreadsheet
  const reportData = entries.map((e, index) => {
    const v = db.vehicles.find(veh => veh.id === e.vehicleId);
    const u = db.users.find(usr => usr.id === e.userId);

    const baseRow: any = {
      'SN': index + 1,
      'Date': e.date,
    };

    if (user.role === 'Admin') {
      baseRow['User Name'] = u?.name || 'Deleted User';
    }

    baseRow['Vehicle Number'] = v?.vehicleNumber || 'Unknown';
    baseRow['Vehicle Name'] = v?.vehicleName || '';
    baseRow['Driver Name'] = e.driverName;
    baseRow['Opening KM'] = e.openingKm;
    baseRow['Closing KM'] = e.closingKm;
    baseRow['Total KM'] = e.totalKm;
    baseRow['Diesel Filled (Litres)'] = e.dieselLitres;
    baseRow['Diesel Amount (₹)'] = e.dieselAmount;
    baseRow['Pump Name'] = e.pumpName;
    baseRow['Remarks'] = e.remarks || '';

    return baseRow;
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportData);

  // Auto-fit column widths (nice aesthetic touch)
  const max_lens = reportData.reduce((acc: any, row: any) => {
    Object.keys(row).forEach((key, colIndex) => {
      const val_str = String(row[key] || '');
      acc[colIndex] = Math.max(acc[colIndex] || 10, val_str.length, key.length);
    });
    return acc;
  }, []);
  ws['!cols'] = max_lens.map((len: number) => ({ wch: len + 3 }));

  XLSX.utils.book_append_sheet(wb, ws, 'Fuel Report');

  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Make clean readable filename
  let filename = 'Fuel_Report';
  if (month) {
    const [year, mNum] = month.split('-');
    const dateObj = new Date(Number(year), Number(mNum) - 1, 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    filename = `Fuel_Report_${monthName}_${year}`;
  } else if (exportType === 'user' && req.query.userId) {
    const targetUser = db.users.find(u => u.id === req.query.userId);
    filename = `Fuel_Report_${targetUser ? targetUser.name.replace(/\s+/g, '_') : 'User'}`;
  } else {
    filename = `Fuel_Report_All_Time_${new Date().toISOString().split('T')[0]}`;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(fileBuffer);
});

// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'Admin' | 'User';
  status: 'Active' | 'Inactive';
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleName: string;
  status: 'Active' | 'Inactive';
}

export interface FuelEntry {
  id: string;
  userId: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  openingKm: number;
  closingKm: number;
  totalKm: number;
  dieselLitres: number;
  dieselAmount: number;
  pumpName: string;
  driverName: string;
  remarks?: string;
  createdAt: string;
  // Enriched fields from server:
  vehicleNumber: string;
  vehicleName: string;
  userName: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardTotals {
  totalKm: number;
  totalLitres: number;
  totalAmount: number;
  totalEntries: number;
}

export type ActiveTab = 'dashboard' | 'logs' | 'add-entry' | 'vehicles' | 'users';

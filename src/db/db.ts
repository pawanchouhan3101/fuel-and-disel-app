import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load .env variables locally with quiet debugging
const envResult = dotenv.config();
if (envResult.error) {
  if ((envResult.error as any).code === 'ENOENT') {
    console.log('ℹ️ [Dotenv] No local .env file found. Reading environment variables from system/process instead.');
  } else {
    console.log('⚠️ [Dotenv] Error loading .env file:', envResult.error.message);
  }
} else {
  const loadedKeys = Object.keys(envResult.parsed || {});
  console.log('📝 [Dotenv] Loaded successfully. Keys found in .env:', loadedKeys);
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
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
}

export interface DatabaseSchema {
  users: User[];
  vehicles: Vehicle[];
  entries: FuelEntry[];
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'db.json');

// In-Memory Database Cache to support synchronous read/write methods instantly
let memoryDb: DatabaseSchema = {
  users: [],
  vehicles: [],
  entries: []
};

// Database state tracker
let mongoClient: MongoClient | null = null;
let isConnected = false;
let dbStatusMessage = 'Initializing database...';
let dbType: 'local' | 'mongodb' = 'local';

// Default seed data
function getDefaultData(): DatabaseSchema {
  return {
    users: [
      {
        id: 'u1',
        name: 'Pawan Chouhan',
        email: 'admin@fuel.com',
        mobile: '9876543210',
        passwordHash: 'admin123',
        role: 'Admin',
        status: 'Active'
      },
      {
        id: 'u2',
        name: 'John Driver',
        email: 'user@fuel.com',
        mobile: '9876543211',
        passwordHash: 'user123',
        role: 'User',
        status: 'Active'
      },
      {
        id: 'u3',
        name: 'Rajesh Kumar',
        email: 'driver1@fuel.com',
        mobile: '9876543212',
        passwordHash: 'driver123',
        role: 'User',
        status: 'Active'
      }
    ],
    vehicles: [
      {
        id: 'v1',
        vehicleNumber: 'MH-12-QW-1234',
        vehicleName: 'Tata Prima Truck',
        status: 'Active'
      },
      {
        id: 'v2',
        vehicleNumber: 'DL-01-AB-5678',
        vehicleName: 'Ashok Leyland Tipper',
        status: 'Active'
      },
      {
        id: 'v3',
        vehicleNumber: 'KA-03-XY-9012',
        vehicleName: 'Mahindra Blazo 49',
        status: 'Active'
      },
      {
        id: 'v4',
        vehicleNumber: 'GJ-01-ZZ-9999',
        vehicleName: 'Eicher Pro Dumper',
        status: 'Inactive'
      }
    ],
    entries: [
      {
        id: 'e1',
        userId: 'u2',
        vehicleId: 'v1',
        date: '2026-05-10',
        openingKm: 12000,
        closingKm: 12450,
        totalKm: 450,
        dieselLitres: 110,
        dieselAmount: 10450,
        pumpName: 'Bharat Petroleum, Pune',
        driverName: 'John Driver',
        remarks: 'First long trip of May',
        createdAt: '2026-05-10T18:00:00.000Z'
      },
      {
        id: 'e2',
        userId: 'u3',
        vehicleId: 'v2',
        date: '2026-05-15',
        openingKm: 45000,
        closingKm: 45320,
        totalKm: 320,
        dieselLitres: 80,
        dieselAmount: 7600,
        pumpName: 'Indian Oil, Delhi',
        driverName: 'Rajesh Kumar',
        remarks: 'Local delivery',
        createdAt: '2026-05-15T19:15:00.000Z'
      },
      {
        id: 'e3',
        userId: 'u2',
        vehicleId: 'v1',
        date: '2026-06-02',
        openingKm: 12450,
        closingKm: 12980,
        totalKm: 530,
        dieselLitres: 130,
        dieselAmount: 12350,
        pumpName: 'HP Petrol Pump, Mumbai',
        driverName: 'John Driver',
        remarks: 'Good mileage observed',
        createdAt: '2026-06-02T17:30:00.000Z'
      },
      {
        id: 'e4',
        userId: 'u3',
        vehicleId: 'v3',
        date: '2026-06-12',
        openingKm: 8200,
        closingKm: 8850,
        totalKm: 650,
        dieselLitres: 160,
        dieselAmount: 15200,
        pumpName: 'Reliance Petroleum, Bengaluru',
        driverName: 'Rajesh Kumar',
        remarks: 'Highway transit',
        createdAt: '2026-06-12T20:00:00.000Z'
      },
      {
        id: 'e5',
        userId: 'u2',
        vehicleId: 'v2',
        date: '2026-06-25',
        openingKm: 45320,
        closingKm: 45700,
        totalKm: 380,
        dieselLitres: 95,
        dieselAmount: 9025,
        pumpName: 'Indian Oil, Delhi',
        driverName: 'John Driver',
        remarks: 'Heavy rain traffic',
        createdAt: '2026-06-25T16:45:00.000Z'
      },
      {
        id: 'e6',
        userId: 'u3',
        vehicleId: 'v1',
        date: '2026-07-01',
        openingKm: 12980,
        closingKm: 13420,
        totalKm: 440,
        dieselLitres: 105,
        dieselAmount: 9975,
        pumpName: 'HP Petrol Pump, Lonavala',
        driverName: 'Rajesh Kumar',
        remarks: 'Routine supply run',
        createdAt: '2026-07-01T15:10:00.000Z'
      }
    ]
  };
}

// Local storage helper
function saveLocal(data: DatabaseSchema) {
  try {
    const tempPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (error) {
    console.error('Error saving local database file:', error);
  }
}

// Initializing local fallback
function initializeFromLocal() {
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      memoryDb = JSON.parse(raw) as DatabaseSchema;
      console.log('📦 Loaded database state from local db.json file.');
    } catch (error) {
      console.error('Error reading db.json, resetting to default state:', error);
      memoryDb = getDefaultData();
      saveLocal(memoryDb);
    }
  } else {
    memoryDb = getDefaultData();
    saveLocal(memoryDb);
  }
}

// Helper to select the database instance.
// If no database name is provided in the URI, it will default to 'fuel_tracker' instead of 'test'
function getMongoDbInstance(client: MongoClient): any {
  const rawUri = process.env.MONGODB_URI || '';
  try {
    let correctedUri = rawUri;
    if (correctedUri.startsWith('mongodb+srv:') && !correctedUri.startsWith('mongodb+srv://')) {
      correctedUri = 'mongodb+srv://' + correctedUri.substring('mongodb+srv:'.length);
    } else if (correctedUri.startsWith('mongodb:') && !correctedUri.startsWith('mongodb://')) {
      correctedUri = 'mongodb://' + correctedUri.substring('mongodb:'.length);
    }

    const urlObj = new URL(correctedUri);
    const pathname = urlObj.pathname.replace(/^\//, ''); // remove leading slash
    if (pathname && pathname.length > 0) {
      console.log(`📡 Using database "${pathname}" specified in connection string.`);
      return client.db(pathname);
    }
  } catch (e) {
    // Ignore URL parsing errors
  }
  console.log('📡 No database name specified in MONGODB_URI. Defaulting to database "fuel_tracker".');
  return client.db('fuel_tracker');
}

// Initializing from MongoDB
async function initializeFromMongo() {
  if (!mongoClient) return;
  try {
    const db = getMongoDbInstance(mongoClient);
    
    // Check if the expected collections exist
    const collections = await db.listCollections().toArray();
    const hasUsers = collections.some(col => col.name === 'users');
    const hasVehicles = collections.some(col => col.name === 'vehicles');
    const hasEntries = collections.some(col => col.name === 'entries');

    let users: any[] = [];
    let vehicles: any[] = [];
    let entries: any[] = [];

    if (hasUsers) users = await db.collection('users').find({}).toArray();
    if (hasVehicles) vehicles = await db.collection('vehicles').find({}).toArray();
    if (hasEntries) entries = await db.collection('entries').find({}).toArray();

    if (users.length === 0 && vehicles.length === 0 && entries.length === 0) {
      console.log('🌱 MongoDB collections are empty. Seeding with current dataset...');
      
      // If our current dataset has records, insert them; otherwise, seed with defaults
      const usersToInsert = memoryDb.users.length > 0 ? memoryDb.users : getDefaultData().users;
      const vehiclesToInsert = memoryDb.vehicles.length > 0 ? memoryDb.vehicles : getDefaultData().vehicles;
      const entriesToInsert = memoryDb.entries.length > 0 ? memoryDb.entries : getDefaultData().entries;

      await db.collection('users').insertMany(usersToInsert);
      await db.collection('vehicles').insertMany(vehiclesToInsert);
      if (entriesToInsert.length > 0) {
        await db.collection('entries').insertMany(entriesToInsert);
      }
      
      memoryDb = {
        users: usersToInsert,
        vehicles: vehiclesToInsert,
        entries: entriesToInsert
      };
      console.log('🌱 Successfully seeded MongoDB with initial/local dataset.');
    } else {
      memoryDb = {
        users: users.map(({ _id, ...u }) => u as User),
        vehicles: vehicles.map(({ _id, ...v }) => v as Vehicle),
        entries: entries.map(({ _id, ...e }) => e as FuelEntry)
      };
      console.log(`📦 MongoDB synced: Loaded ${memoryDb.users.length} users, ${memoryDb.vehicles.length} vehicles, ${memoryDb.entries.length} fuel entries.`);
    }

    // Keep db.json as backup
    saveLocal(memoryDb);
  } catch (err) {
    console.error('Error during MongoDB initialization:', err);
    dbStatusMessage = `Error reading MongoDB data: ${(err as Error).message}. Using Local fallback.`;
    dbType = 'local';
    // We already have memoryDb loaded from initializeFromLocal on start, so we just use that as a safe backup
  }
}

// Core sync algorithm to update MongoDB collections in the background
async function syncCollectionToMongo(collectionName: 'users' | 'vehicles' | 'entries', dataArray: any[]) {
  if (!mongoClient || !isConnected) return;
  try {
    const db = getMongoDbInstance(mongoClient);
    const col = db.collection(collectionName);
    
    // 1. Upsert all current items
    for (const item of dataArray) {
      await col.updateOne({ id: item.id }, { $set: item }, { upsert: true });
    }
    
    // 2. Clear items that no longer exist in our current collection
    const currentIds = dataArray.map(item => item.id);
    await col.deleteMany({ id: { $nin: currentIds } });
    
    console.log(`✨ Successfully synced collection "${collectionName}" to MongoDB.`);
  } catch (err) {
    console.error(`❌ Background sync error for collection "${collectionName}":`, err);
  }
}

// Database Connection Orchestrator

// Load local fallback database first to guarantee memoryDb is always populated on server boot
initializeFromLocal();

let MONGO_URI = process.env.MONGODB_URI;

if (MONGO_URI && MONGO_URI.trim().length > 0) {
  // Auto-correct common missing double-slash typo: e.g. mongodb+srv:username -> mongodb+srv://username
  if (MONGO_URI.startsWith('mongodb+srv:') && !MONGO_URI.startsWith('mongodb+srv://')) {
    MONGO_URI = 'mongodb+srv://' + MONGO_URI.substring('mongodb+srv:'.length);
    console.log('🔧 Auto-corrected MONGODB_URI double slash typo.');
  } else if (MONGO_URI.startsWith('mongodb:') && !MONGO_URI.startsWith('mongodb://')) {
    MONGO_URI = 'mongodb://' + MONGO_URI.substring('mongodb:'.length);
    console.log('🔧 Auto-corrected MONGODB_URI double slash typo.');
  }

  dbType = 'mongodb';
  dbStatusMessage = 'Connecting to MongoDB...';
  
  const hasPlaceholders = MONGO_URI.includes('<db_username>') || 
                          MONGO_URI.includes('<db_password>') || 
                          MONGO_URI.includes('<username>') || 
                          MONGO_URI.includes('<password>') || 
                          (MONGO_URI.includes('<') && MONGO_URI.includes('>'));

  if (hasPlaceholders) {
    dbType = 'local';
    isConnected = false;
    dbStatusMessage = `MONGODB_PLACEHOLDERS_DETECTED: Your MONGODB_URI contains placeholder tags like <db_username> or <db_password>. Please edit MONGODB_URI in the Settings gear icon (top-right) and replace these placeholder tags with your actual database user's username and password.`;
    console.error('❌ [MongoDB Connection Error] Placeholder tags detected in MONGODB_URI!');
  } else {
    // Connect asynchronously to prevent blocking server boot
    MongoClient.connect(MONGO_URI)
      .then(async (client) => {
        mongoClient = client;
        isConnected = true;
        dbStatusMessage = 'Connected to MongoDB Cloud';
        console.log('✅ Connected to MongoDB server successfully.');
        await initializeFromMongo();
      })
      .catch((err) => {
        dbType = 'local';
        isConnected = false;
        const errMsg = (err as Error).message || '';
        const isIpIssue = errMsg.includes('tlsv1 alert internal error') || 
                          errMsg.includes('SSL alert number 80') || 
                          errMsg.includes('ssl3_read_bytes') || 
                          errMsg.includes('MongoServerSelectionError');
        const isAuthIssue = errMsg.includes('bad auth') || 
                            errMsg.includes('Authentication failed') || 
                            errMsg.includes('auth failed') ||
                            errMsg.includes('authSource');
        
        if (isIpIssue) {
          dbStatusMessage = `IP_ACCESS_BLOCKED: MongoDB connection rejected. Please add '0.0.0.0/0' to your MongoDB Atlas Network Access (IP Access List) to authorize this dynamic cloud sandbox.`;
          console.log('ℹ️ [MongoDB Notice] IP Access is restricted. Operating on local JSON storage backup.');
          console.log('👉 ACTION REQUIRED: Log in to MongoDB Atlas (cloud.mongodb.com), go to Security -> Network Access, click "Add IP Address", and enter "0.0.0.0/0" (Allow Access from Anywhere) so this cloud instance can connect.');
        } else if (isAuthIssue) {
          dbStatusMessage = `MONGODB_AUTH_FAILED: Authentication failed. Please verify that the username and password in your MONGODB_URI are correct, and do not contain special characters that aren't URL-encoded.`;
          console.log('ℹ️ [MongoDB Notice] Authentication rejected (bad auth). Operating on local JSON storage backup.');
          console.log('👉 ACTION REQUIRED: Please check your MONGODB_URI environment variable/secret in Settings. Make sure the username, password, and database name are correct.');
        } else {
          dbStatusMessage = `Connection Failed: ${errMsg}. Using Local JSON fallback.`;
          console.log(`ℹ️ [MongoDB Notice] Connection could not be established (${errMsg}). Operating on local JSON storage fallback.`);
        }
      });
  }
} else {
  dbType = 'local';
  dbStatusMessage = 'Using Local Storage (db.json). Enter MONGODB_URI in secrets to connect MongoDB.';
  console.log('ℹ️ No MONGODB_URI found. Defaulting to local db.json.');
}

// PUBLIC API EXPORTS

export function getDb(): DatabaseSchema {
  return memoryDb;
}

export function updateDb(updater: (db: DatabaseSchema) => void) {
  updater(memoryDb);
  
  // 1. Instantly write to local file fallback
  saveLocal(memoryDb);

  // 2. Perform background synchronization to MongoDB if active
  if (mongoClient && isConnected) {
    syncCollectionToMongo('users', memoryDb.users);
    syncCollectionToMongo('vehicles', memoryDb.vehicles);
    syncCollectionToMongo('entries', memoryDb.entries);
  }
}

export function getDbStatus() {
  return {
    type: dbType,
    connected: isConnected,
    message: dbStatusMessage
  };
}

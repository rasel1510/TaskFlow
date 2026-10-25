import fs from 'fs';
import path from 'path';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: string;
  avatar: string;
  expertise?: string[];
  emailVerified?: string;
  createdAt: string;
}

const USERS_FILE = path.join(process.cwd(), 'src', 'data', 'users.json');

// In-memory cache for ultra-fast access and resilience
let memoryUsers: StoredUser[] = [];
let isLoaded = false;

function loadUsers(): StoredUser[] {
  if (isLoaded && memoryUsers.length > 0) {
    return memoryUsers;
  }

  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        memoryUsers = parsed;
        isLoaded = true;
        return memoryUsers;
      }
    }
  } catch (err) {
    console.warn('[userStore] Error reading users.json:', err);
  }

  isLoaded = true;
  return memoryUsers;
}

function saveUsers(usersList: StoredUser[]): void {
  memoryUsers = usersList;
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[userStore] Error writing users.json:', err);
  }
}

export function findStoredUserByEmail(email: string): StoredUser | null {
  const normalized = email.toLowerCase().trim();
  const allUsers = loadUsers();
  return allUsers.find(u => u.email.toLowerCase().trim() === normalized) || null;
}

export function findStoredUserById(id: string): StoredUser | null {
  const allUsers = loadUsers();
  return allUsers.find(u => u.id === id) || null;
}

export function saveStoredUser(data: {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: string;
  avatar: string;
  expertise?: string[];
  emailVerified?: string;
}): StoredUser {
  const allUsers = loadUsers();
  const normalized = data.email.toLowerCase().trim();

  const existingIndex = allUsers.findIndex(u => u.email.toLowerCase().trim() === normalized);
  const newUser: StoredUser = {
    id: data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name,
    email: normalized,
    password: data.password,
    role: data.role || 'User',
    avatar: data.avatar,
    expertise: data.expertise !== undefined ? data.expertise : (existingIndex >= 0 ? allUsers[existingIndex].expertise : []),
    emailVerified: data.emailVerified !== undefined ? data.emailVerified : (existingIndex >= 0 ? allUsers[existingIndex].emailVerified : undefined),
    createdAt: existingIndex >= 0 ? allUsers[existingIndex].createdAt : new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    allUsers[existingIndex] = newUser;
  } else {
    allUsers.push(newUser);
  }

  saveUsers(allUsers);
  return newUser;
}

export function updateStoredUser(
  idOrEmail: string,
  updates: Partial<Omit<StoredUser, 'id'>>
): StoredUser | null {
  const allUsers = loadUsers();
  const normalized = idOrEmail.toLowerCase().trim();
  const index = allUsers.findIndex(
    u => u.id === idOrEmail || u.email.toLowerCase().trim() === normalized
  );

  if (index === -1) {
    return null;
  }

  const existing = allUsers[index];
  const updatedUser: StoredUser = {
    ...existing,
    ...updates,
    id: existing.id,
    email: updates.email ? updates.email.toLowerCase().trim() : existing.email,
  };

  allUsers[index] = updatedUser;
  saveUsers(allUsers);
  return updatedUser;
}

export function getAllStoredUsers(): StoredUser[] {
  return loadUsers();
}

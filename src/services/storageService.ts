import { PropertyObject, HistoryEvent } from '../types';
import { INITIAL_130_OBJECTS } from '../data/initialObjects';

const DB_NAME = 'atyrau_field_gis_db';
const DB_VERSION = 1;
const USER_DATA_STORE = 'user_modifications';
const CUSTOM_OBJECTS_STORE = 'custom_objects';
const METADATA_STORE = 'metadata_store';

const LS_USER_DATA_KEY = 'atyrau_gis_user_data_v1';
const LS_CUSTOM_KEY = 'atyrau_gis_custom_objects_v1';
const LS_LAST_SAVE_KEY = 'atyrau_gis_last_save_time';

export type UserObjectUpdate = Partial<PropertyObject> & { id: number };

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(USER_DATA_STORE)) {
        db.createObjectStore(USER_DATA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CUSTOM_OBJECTS_STORE)) {
        db.createObjectStore(CUSTOM_OBJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Storage Engine managing durable persistence across reloads, deployments, and offline sessions
 */
export class StorageService {
  private static lastSaveTime: string | null = null;
  private static listeners: Array<(time: string) => void> = [];

  static subscribeLastSave(listener: (time: string) => void) {
    this.listeners.push(listener);
    if (this.lastSaveTime) listener(this.lastSaveTime);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notifySave() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    this.lastSaveTime = timeStr;
    try {
      localStorage.setItem(LS_LAST_SAVE_KEY, timeStr);
    } catch {
      // ignore
    }
    this.listeners.forEach((l) => l(timeStr));
  }

  static getLastSaveTime(): string | null {
    if (this.lastSaveTime) return this.lastSaveTime;
    try {
      return localStorage.getItem(LS_LAST_SAVE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Loads all merged objects (INITIAL + USER MODIFICATIONS + CUSTOM ADDED)
   */
  static async loadAllObjects(): Promise<PropertyObject[]> {
    let userModificationsMap: Record<number, Partial<PropertyObject>> = {};
    let customObjectsList: PropertyObject[] = [];

    // 1. Try to load from IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction([USER_DATA_STORE, CUSTOM_OBJECTS_STORE], 'readonly');

      const userStore = tx.objectStore(USER_DATA_STORE);
      const customStore = tx.objectStore(CUSTOM_OBJECTS_STORE);

      const userMods: UserObjectUpdate[] = await new Promise((res, rej) => {
        const req = userStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });

      const customs: PropertyObject[] = await new Promise((res, rej) => {
        const req = customStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });

      userMods.forEach((mod) => {
        userModificationsMap[mod.id] = mod;
      });
      customObjectsList = customs;
    } catch {
      // Fallback to localStorage
      try {
        const rawUserMods = localStorage.getItem(LS_USER_DATA_KEY);
        if (rawUserMods) {
          userModificationsMap = JSON.parse(rawUserMods);
        }
        const rawCustoms = localStorage.getItem(LS_CUSTOM_KEY);
        if (rawCustoms) {
          customObjectsList = JSON.parse(rawCustoms);
        }
      } catch {
        // Continue with initial data
      }
    }

    // 2. Merge Initial Objects with User Modifications
    const mergedInitial = INITIAL_130_OBJECTS.map((initObj) => {
      const userMod = userModificationsMap[initObj.id];
      if (!userMod) {
        return { ...initObj };
      }
      return {
        ...initObj,
        ...userMod,
        // Ensure coordinates preserve user edits
        currentLatitude: userMod.currentLatitude ?? userMod.actualLatitude ?? initObj.originalLatitude,
        currentLongitude: userMod.currentLongitude ?? userMod.actualLongitude ?? initObj.originalLongitude,
        photos: userMod.photos ?? initObj.photos ?? [],
        history: userMod.history ?? initObj.history ?? []
      };
    });

    // 3. Append custom objects
    const allObjects = [...mergedInitial, ...customObjectsList];
    return allObjects;
  }

  /**
   * Persists a user update for a specific property object
   */
  static async saveObjectUpdate(id: number, updates: Partial<PropertyObject>): Promise<void> {
    const updatePayload: UserObjectUpdate = { id, ...updates, updatedAt: new Date().toISOString() };

    // Save to IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(USER_DATA_STORE, 'readwrite');
      const store = tx.objectStore(USER_DATA_STORE);
      await new Promise<void>((res, rej) => {
        const req = store.put(updatePayload);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    } catch {
      // Fallback to localStorage
    }

    // Mirror to localStorage
    try {
      const existingRaw = localStorage.getItem(LS_USER_DATA_KEY);
      const existing: Record<number, Partial<PropertyObject>> = existingRaw ? JSON.parse(existingRaw) : {};
      existing[id] = { ...(existing[id] || {}), ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(LS_USER_DATA_KEY, JSON.stringify(existing));
    } catch {
      // storage quota or private mode
    }

    this.notifySave();
  }

  /**
   * Batch save multiple objects (e.g. after import or bulk operations)
   */
  static async saveMultipleUpdates(updates: Array<UserObjectUpdate>): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(USER_DATA_STORE, 'readwrite');
      const store = tx.objectStore(USER_DATA_STORE);
      for (const update of updates) {
        store.put(update);
      }
    } catch {
      // ignore
    }

    try {
      const existingRaw = localStorage.getItem(LS_USER_DATA_KEY);
      const existing: Record<number, Partial<PropertyObject>> = existingRaw ? JSON.parse(existingRaw) : {};
      updates.forEach((up) => {
        existing[up.id] = { ...(existing[up.id] || {}), ...up };
      });
      localStorage.setItem(LS_USER_DATA_KEY, JSON.stringify(existing));
    } catch {
      // ignore
    }

    this.notifySave();
  }

  /**
   * Adds or updates a custom property object
   */
  static async saveCustomObject(obj: PropertyObject): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(CUSTOM_OBJECTS_STORE, 'readwrite');
      const store = tx.objectStore(CUSTOM_OBJECTS_STORE);
      await new Promise<void>((res, rej) => {
        const req = store.put(obj);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    } catch {
      // fallback
    }

    try {
      const existingRaw = localStorage.getItem(LS_CUSTOM_KEY);
      const existing: PropertyObject[] = existingRaw ? JSON.parse(existingRaw) : [];
      const idx = existing.findIndex((o) => o.id === obj.id);
      if (idx >= 0) existing[idx] = obj;
      else existing.push(obj);
      localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(existing));
    } catch {
      // ignore
    }

    this.notifySave();
  }

  /**
   * Adds an event to the object's history log
   */
  static async logHistoryEvent(
    objectId: number,
    action: string,
    details: string,
    currentHistory: HistoryEvent[]
  ): Promise<HistoryEvent[]> {
    const newEvent: HistoryEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user: 'Инспектор'
    };
    const updatedHistory = [newEvent, ...(currentHistory || [])];
    await this.saveObjectUpdate(objectId, { history: updatedHistory });
    return updatedHistory;
  }

  /**
   * Creates a full JSON backup of all user progress
   */
  static async exportBackupData(): Promise<string> {
    const allObjects = await this.loadAllObjects();
    const backup = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      city: 'Атырау',
      totalObjects: allObjects.length,
      objects: allObjects
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restores data from backup, merging without deleting existing progress
   */
  static async restoreBackupData(backupJson: string): Promise<number> {
    const parsed = JSON.parse(backupJson);
    if (!parsed.objects || !Array.isArray(parsed.objects)) {
      throw new Error('Некорректный формат файла резервной копии');
    }
    const updates: UserObjectUpdate[] = [];
    for (const obj of parsed.objects) {
      if (obj.id) {
        updates.push({
          id: obj.id,
          status: obj.status,
          actualAddress: obj.actualAddress,
          actualLatitude: obj.actualLatitude,
          actualLongitude: obj.actualLongitude,
          currentLatitude: obj.currentLatitude,
          currentLongitude: obj.currentLongitude,
          verificationComment: obj.verificationComment,
          photos: obj.photos,
          verifiedAt: obj.verifiedAt,
          verifier: obj.verifier,
          history: obj.history,
          isArchived: obj.isArchived
        });
      }
    }
    await this.saveMultipleUpdates(updates);
    return updates.length;
  }

  /**
   * Clears only user modifications (leaves initial 130 objects intact)
   */
  static async resetUserDataOnly(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction([USER_DATA_STORE, CUSTOM_OBJECTS_STORE], 'readwrite');
      tx.objectStore(USER_DATA_STORE).clear();
      tx.objectStore(CUSTOM_OBJECTS_STORE).clear();
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(LS_USER_DATA_KEY);
      localStorage.removeItem(LS_CUSTOM_KEY);
      localStorage.removeItem(LS_LAST_SAVE_KEY);
    } catch {
      // ignore
    }
    this.notifySave();
  }
}

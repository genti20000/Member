/**
 * JONNY'S MEMBERS - Cloud Firestore Database Service
 *
 * Connects to the provisioned Google Cloud Firestore database:
 * Database ID: ai-studio-jonnysmembers-2f030468-2445-492d-9868-aa8da0aa192f
 * Project: alert-triode-xggh3
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Member, VisitRecord, IncidentRecord, AuditEvent } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Target provisioned Firestore Database
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connection state
let isConnected = false;

/**
 * Validate connection to Firestore on boot (Mandated by Firebase Skill)
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isConnected = true;
    console.log('[Firestore] Database connected successfully:', firebaseConfig.firestoreDatabaseId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Please check your Firebase configuration: client is offline');
      isConnected = false;
      return false;
    }
    // Document might not exist yet, but server answered
    isConnected = true;
    return true;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

/**
 * Save / Update Member in Firestore
 */
export async function saveMemberToDb(member: Member): Promise<void> {
  try {
    const ref = doc(db, 'members', member.id);
    await setDoc(ref, {
      ...member,
      _updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving member:', err);
  }
}

/**
 * Save / Update Visit in Firestore
 */
export async function saveVisitToDb(visit: VisitRecord): Promise<void> {
  try {
    const ref = doc(db, 'visits', visit.id);
    await setDoc(ref, {
      ...visit,
      _updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving visit:', err);
  }
}

/**
 * Save Incident to Firestore
 */
export async function saveIncidentToDb(incident: IncidentRecord): Promise<void> {
  try {
    const ref = doc(db, 'incidents', incident.id);
    await setDoc(ref, {
      ...incident,
      _createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving incident:', err);
  }
}

/**
 * Save Audit Log to Firestore
 */
export async function saveAuditLogToDb(log: AuditEvent): Promise<void> {
  try {
    const ref = doc(db, 'audit_logs', log.id);
    await setDoc(ref, {
      ...log,
      _createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving audit log:', err);
  }
}

/**
 * Real-time synchronization listeners for members, visits, incidents
 */
export function setupFirestoreRealtimeListeners(callbacks: {
  onMembersUpdate?: (members: Member[]) => void;
  onVisitsUpdate?: (visits: VisitRecord[]) => void;
  onIncidentsUpdate?: (incidents: IncidentRecord[]) => void;
}): () => void {
  const unsubscribes: Array<() => void> = [];

  try {
    // Listen to Members collection
    if (callbacks.onMembersUpdate) {
      const membersRef = collection(db, 'members');
      const unsub = onSnapshot(membersRef, (snapshot) => {
        if (!snapshot.empty) {
          const membersList: Member[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Member;
            membersList.push(data);
          });
          callbacks.onMembersUpdate?.(membersList);
        }
      }, (err) => {
        console.warn('[Firestore] Members sync error:', err.message);
      });
      unsubscribes.push(unsub);
    }

    // Listen to Visits collection
    if (callbacks.onVisitsUpdate) {
      const visitsRef = collection(db, 'visits');
      const unsub = onSnapshot(visitsRef, (snapshot) => {
        if (!snapshot.empty) {
          const visitsList: VisitRecord[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as VisitRecord;
            visitsList.push(data);
          });
          callbacks.onVisitsUpdate?.(visitsList);
        }
      }, (err) => {
        console.warn('[Firestore] Visits sync error:', err.message);
      });
      unsubscribes.push(unsub);
    }

    // Listen to Incidents collection
    if (callbacks.onIncidentsUpdate) {
      const incidentsRef = collection(db, 'incidents');
      const unsub = onSnapshot(incidentsRef, (snapshot) => {
        if (!snapshot.empty) {
          const incidentsList: IncidentRecord[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as IncidentRecord;
            incidentsList.push(data);
          });
          callbacks.onIncidentsUpdate?.(incidentsList);
        }
      }, (err) => {
        console.warn('[Firestore] Incidents sync error:', err.message);
      });
      unsubscribes.push(unsub);
    }
  } catch (err) {
    console.error('[Firestore] Error attaching listeners:', err);
  }

  return () => {
    unsubscribes.forEach((fn) => fn());
  };
}

// Seed initial database records if remote collection is empty
export async function seedInitialFirestoreData(initialData: {
  members: Member[];
  visits: VisitRecord[];
  incidents: IncidentRecord[];
}): Promise<void> {
  try {
    const membersSnap = await getDocs(collection(db, 'members'));
    if (membersSnap.empty) {
      console.log('[Firestore] Seeding initial members into cloud database...');
      for (const m of initialData.members) {
        await setDoc(doc(db, 'members', m.id), m);
      }
    }

    const visitsSnap = await getDocs(collection(db, 'visits'));
    if (visitsSnap.empty) {
      console.log('[Firestore] Seeding initial visits into cloud database...');
      for (const v of initialData.visits) {
        await setDoc(doc(db, 'visits', v.id), v);
      }
    }

    const incidentsSnap = await getDocs(collection(db, 'incidents'));
    if (incidentsSnap.empty) {
      console.log('[Firestore] Seeding initial incidents into cloud database...');
      for (const i of initialData.incidents) {
        await setDoc(doc(db, 'incidents', i.id), i);
      }
    }
  } catch (err) {
    console.warn('[Firestore] Seeding skipped or error:', err);
  }
}

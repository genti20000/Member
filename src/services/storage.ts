/**
 * JONNY'S MEMBERS - State Management & Storage Service
 *
 * Implements persistent browser storage with automatic audit logging,
 * reactive subscriptions, and time simulation capabilities.
 */

import {
  Member,
  StaffUser,
  ClubRuleVersion,
  VisitRecord,
  ProprietorGuest,
  SmokingPatron,
  CapacitySnapshot,
  IncidentRecord,
  AuditEvent,
  UserRole,
} from '../types';

import {
  INITIAL_MEMBERS,
  INITIAL_STAFF,
  INITIAL_RULES,
  INITIAL_VISITS,
  INITIAL_PROPRIETOR_GUESTS,
  INITIAL_SMOKING_PATRONS,
  INITIAL_HOURLY_CAPACITIES,
  INITIAL_INCIDENTS,
  INITIAL_AUDIT_LOGS,
} from '../data/mockSeed';

import {
  saveMemberToDb,
  saveVisitToDb,
  saveIncidentToDb,
  saveAuditLogToDb,
  testConnection,
  setupFirestoreRealtimeListeners,
  seedInitialFirestoreData,
} from './firebase';

const STORAGE_KEYS = {
  MEMBERS: 'jonnys_members_v2',
  STAFF: 'jonnys_staff_v2',
  CURRENT_STAFF_ID: 'jonnys_current_staff_id_v2',
  RULES: 'jonnys_rules_v2',
  VISITS: 'jonnys_visits_v2',
  PROPRIETOR_GUESTS: 'jonnys_proprietor_guests_v2',
  SMOKING: 'jonnys_smoking_v2',
  HOURLY_CAPACITIES: 'jonnys_hourly_capacities_v2',
  INCIDENTS: 'jonnys_incidents_v2',
  AUDIT_LOGS: 'jonnys_audit_logs_v2',
  SIMULATED_TIME_OFFSET_MS: 'jonnys_simulated_time_offset_ms',
  IS_TIME_SIMULATION_ACTIVE: 'jonnys_is_time_simulation_active',
};

// Listeners
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error('Storage listener error:', err);
    }
  });
}

export function subscribeToStore(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
}

// SIMULATED VENUE CLOCK
let simulatedOffsetMs = parseInt(localStorage.getItem(STORAGE_KEYS.SIMULATED_TIME_OFFSET_MS) || '0', 10);
let isSimulationActive = localStorage.getItem(STORAGE_KEYS.IS_TIME_SIMULATION_ACTIVE) === 'true';

export function getVenueCurrentDate(): Date {
  if (!isSimulationActive || !simulatedOffsetMs) {
    return new Date();
  }
  return new Date(Date.now() + simulatedOffsetMs);
}

export function setSimulatedVenueTime(targetDate: Date | null): void {
  if (!targetDate) {
    isSimulationActive = false;
    simulatedOffsetMs = 0;
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_TIME_OFFSET_MS);
    localStorage.removeItem(STORAGE_KEYS.IS_TIME_SIMULATION_ACTIVE);
  } else {
    isSimulationActive = true;
    simulatedOffsetMs = targetDate.getTime() - Date.now();
    localStorage.setItem(STORAGE_KEYS.SIMULATED_TIME_OFFSET_MS, simulatedOffsetMs.toString());
    localStorage.setItem(STORAGE_KEYS.IS_TIME_SIMULATION_ACTIVE, 'true');
  }
  notify();
}

export function isTimeSimulationEnabled(): boolean {
  return isSimulationActive;
}

// STORE METHODS
export const clubStore = {
  // Members
  getMembers(): Member[] {
    return getItem(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS);
  },

  getMemberById(id: string): Member | undefined {
    return this.getMembers().find((m) => m.id === id || m.memberNumber === id);
  },

  saveMember(member: Member, actor?: { id: string; name: string; role: UserRole }, reason?: string): void {
    const members = this.getMembers();
    const existingIndex = members.findIndex((m) => m.id === member.id);
    let previousValue: string | undefined;

    if (existingIndex >= 0) {
      previousValue = members[existingIndex].status;
      members[existingIndex] = member;
    } else {
      members.unshift(member);
    }

    setItem(STORAGE_KEYS.MEMBERS, members);
    // Persist to Cloud Firestore database
    saveMemberToDb(member);

    if (actor) {
      this.addAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: existingIndex >= 0 ? `UPDATE_MEMBER_${member.status.toUpperCase()}` : 'NEW_MEMBER_APPLICATION',
        targetType: 'member',
        targetId: member.id,
        targetName: member.fullName,
        previousValue,
        newValue: member.status,
        reason,
      });
    }

    notify();
  },

  /**
   * Admin-Only 48-Hour Waiting Period Bypass Option:
   * Backdates the sign-up timestamp to 48+ hours ago (e.g. 49 hours prior)
   * to officially record that nomination/application was done 48 hours before,
   * activating the membership immediately and updating Cloud Firestore.
   */
  bypass48HourWaiting(memberId: string, actor: StaffUser, justification?: string): Member | null {
    const members = this.getMembers();
    const member = members.find((m) => m.id === memberId);
    if (!member) return null;

    const backdatedAppliedTime = new Date(Date.now() - 49 * 3600 * 1000).toISOString();
    const backdatedEligibleTime = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    const approvedAt = new Date().toISOString();

    const previousStatus = member.status;
    const updated: Member = {
      ...member,
      appliedAt: backdatedAppliedTime,
      eligibleAt: backdatedEligibleTime,
      status: 'active',
      approvedAt,
      approvedBy: actor.name,
      notes: (member.notes ? member.notes + ' | ' : '') + `[ADMIN OVERRIDE by ${actor.name} (${actor.badgeNumber})]: Sign-up backdated to 48 hours prior (${justification || 'Paper application / prior historical register verified'}).`,
    };

    this.saveMember(
      updated,
      { id: actor.id, name: actor.name, role: actor.role },
      justification || 'Admin override: backdated sign-up time to 48 hours prior'
    );

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'ADMIN_BYPASS_48H_WAITING_BACKDATE',
      targetType: 'member',
      targetId: member.id,
      targetName: member.fullName,
      previousValue: previousStatus,
      newValue: 'active',
      reason: justification || 'Admin override: verified sign-up completed 48 hours prior',
    });

    return updated;
  },


  // Staff & Auth
  getStaffList(): StaffUser[] {
    return getItem(STORAGE_KEYS.STAFF, INITIAL_STAFF);
  },

  getCurrentStaff(): StaffUser {
    const list = this.getStaffList();
    const storedId = localStorage.getItem(STORAGE_KEYS.CURRENT_STAFF_ID);
    return list.find((s) => s.id === storedId) || list[1]; // default to Christian Pettitt (Manager)
  },

  setCurrentStaff(staffId: string): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STAFF_ID, staffId);
    notify();
  },

  // Rules
  getRuleVersions(): ClubRuleVersion[] {
    return getItem(STORAGE_KEYS.RULES, INITIAL_RULES);
  },

  getCurrentRuleVersion(): ClubRuleVersion {
    const versions = this.getRuleVersions();
    return versions[versions.length - 1];
  },

  addRuleVersion(version: ClubRuleVersion, actor: StaffUser): void {
    const versions = this.getRuleVersions();
    versions.push(version);
    setItem(STORAGE_KEYS.RULES, versions);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'PUBLISH_NEW_RULE_VERSION',
      targetType: 'rule',
      targetId: version.version,
      targetName: version.title,
      newValue: `v${version.version}`,
      reason: 'Statutory rule revision uploaded.',
    });

    notify();
  },

  // Visits & Attendance
  getVisits(): VisitRecord[] {
    return getItem(STORAGE_KEYS.VISITS, INITIAL_VISITS);
  },

  saveVisit(visit: VisitRecord): void {
    const visits = this.getVisits();
    const idx = visits.findIndex((v) => v.id === visit.id);
    if (idx >= 0) {
      visits[idx] = visit;
    } else {
      visits.unshift(visit);
    }
    setItem(STORAGE_KEYS.VISITS, visits);
    saveVisitToDb(visit);
    notify();
  },

  checkOutVisit(visitId: string, staff: StaffUser): void {
    const visits = this.getVisits();
    const visit = visits.find((v) => v.id === visitId);
    if (visit) {
      visit.isCurrentlyInside = false;
      visit.isOutToSmoke = false;
      visit.checkOutTime = getVenueCurrentDate().toISOString();
      setItem(STORAGE_KEYS.VISITS, visits);
      saveVisitToDb(visit);

      // Remove from smoking if currently out
      this.removeSmokingPatronByVisitId(visitId);

      this.addAuditLog({
        actorId: staff.id,
        actorName: staff.name,
        actorRole: staff.role,
        action: 'CHECK_OUT',
        targetType: 'visit',
        targetId: visit.id,
        targetName: visit.memberName,
      });

      notify();
    }
  },

  // Proprietor Guests
  getProprietorGuests(): ProprietorGuest[] {
    return getItem(STORAGE_KEYS.PROPRIETOR_GUESTS, INITIAL_PROPRIETOR_GUESTS);
  },

  addProprietorGuest(guest: ProprietorGuest, manager: StaffUser): void {
    const guests = this.getProprietorGuests();
    guests.unshift(guest);
    setItem(STORAGE_KEYS.PROPRIETOR_GUESTS, guests);

    // Also register in attendance visit records
    const visit: VisitRecord = {
      id: `vis-prop-${Date.now()}`,
      date: getVenueCurrentDate().toISOString().split('T')[0],
      attendeeType: 'proprietor_guest',
      memberName: guest.fullName,
      guestNames: [],
      checkInTime: guest.checkInTime,
      isCurrentlyInside: true,
      isOutToSmoke: false,
      responsibleStaffId: manager.id,
      responsibleStaffName: manager.name,
    };
    this.saveVisit(visit);

    this.addAuditLog({
      actorId: manager.id,
      actorName: manager.name,
      actorRole: manager.role,
      action: 'AUTHORIZE_PROPRIETOR_GUEST',
      targetType: 'guest',
      targetId: guest.id,
      targetName: guest.fullName,
      newValue: guest.affiliationOrReason,
      reason: 'Proprietor guest authorised by management.',
    });

    notify();
  },

  // Smoking Management
  getSmokingPatrons(): SmokingPatron[] {
    return getItem(STORAGE_KEYS.SMOKING, INITIAL_SMOKING_PATRONS);
  },

  markOutToSmoke(patron: {
    visitId: string;
    name: string;
    type: 'member' | 'guest' | 'proprietor_guest';
  }): void {
    const list = this.getSmokingPatrons();
    const newPatron: SmokingPatron = {
      id: `smoke-${Date.now()}`,
      visitId: patron.visitId,
      name: patron.name,
      type: patron.type,
      exitTimestamp: getVenueCurrentDate().toISOString(),
      expectedReturnMinutes: 10,
    };
    list.unshift(newPatron);
    setItem(STORAGE_KEYS.SMOKING, list);

    // Update visit
    const visits = this.getVisits();
    const v = visits.find((item) => item.id === patron.visitId);
    if (v) {
      v.isOutToSmoke = true;
      v.smokeExitTime = newPatron.exitTimestamp;
      setItem(STORAGE_KEYS.VISITS, visits);
    }

    notify();
  },

  markSmokingReturned(smokeId: string): void {
    const list = this.getSmokingPatrons();
    const patron = list.find((p) => p.id === smokeId);
    if (patron) {
      const remaining = list.filter((p) => p.id !== smokeId);
      setItem(STORAGE_KEYS.SMOKING, remaining);

      // Update visit
      const visits = this.getVisits();
      const v = visits.find((item) => item.id === patron.visitId);
      if (v) {
        v.isOutToSmoke = false;
        setItem(STORAGE_KEYS.VISITS, visits);
      }

      notify();
    }
  },

  removeSmokingPatronByVisitId(visitId: string): void {
    const list = this.getSmokingPatrons().filter((p) => p.visitId !== visitId);
    setItem(STORAGE_KEYS.SMOKING, list);
  },

  // Capacity & Counts
  getCapacityStats(): {
    totalCustomers: number;
    membersInside: number;
    guestsInside: number;
    proprietorGuestsInside: number;
    smokersOutside: number;
    staffInside: number;
  } {
    const visits = this.getVisits().filter((v) => v.isCurrentlyInside);
    let members = 0;
    let memberGuests = 0;
    let proprietorGuests = 0;

    visits.forEach((v) => {
      if (v.attendeeType === 'member') {
        members += 1;
        memberGuests += v.guestNames?.length || 0;
      } else if (v.attendeeType === 'proprietor_guest') {
        proprietorGuests += 1;
      } else if (v.attendeeType === 'member_guest') {
        memberGuests += 1;
      }
    });

    const smokers = this.getSmokingPatrons().length;
    const staffCount = 7; // Fixed baseline on-duty door, bar, reception, management team

    return {
      totalCustomers: members + memberGuests + proprietorGuests,
      membersInside: members,
      guestsInside: memberGuests,
      proprietorGuestsInside: proprietorGuests,
      smokersOutside: smokers,
      staffInside: staffCount,
    };
  },

  getHourlyCapacities(): CapacitySnapshot[] {
    return getItem(STORAGE_KEYS.HOURLY_CAPACITIES, INITIAL_HOURLY_CAPACITIES);
  },

  recordHourlyCapacitySnapshot(): void {
    const stats = this.getCapacityStats();
    const snapshots = this.getHourlyCapacities();
    const newSnapshot: CapacitySnapshot = {
      id: `cap-${Date.now()}`,
      timestamp: getVenueCurrentDate().toISOString(),
      customerCount: stats.totalCustomers,
      maxCapacity: 80,
      staffCount: stats.staffInside,
      membersCount: stats.membersInside,
      memberGuestsCount: stats.guestsInside,
      proprietorGuestsCount: stats.proprietorGuestsInside,
      smokersOutside: stats.smokersOutside,
    };
    snapshots.unshift(newSnapshot);
    setItem(STORAGE_KEYS.HOURLY_CAPACITIES, snapshots);
    notify();
  },

  // Incidents
  getIncidents(): IncidentRecord[] {
    return getItem(STORAGE_KEYS.INCIDENTS, INITIAL_INCIDENTS);
  },

  addIncident(incident: IncidentRecord, staff: StaffUser): void {
    const list = this.getIncidents();
    list.unshift(incident);
    setItem(STORAGE_KEYS.INCIDENTS, list);
    saveIncidentToDb(incident);

    this.addAuditLog({
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      action: 'LOG_INCIDENT',
      targetType: 'incident',
      targetId: incident.incidentNumber,
      targetName: incident.categoryLabel,
      reason: incident.description.substring(0, 100),
    });

    notify();
  },

  // Audit Logs
  getAuditLogs(): AuditEvent[] {
    return getItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  },

  addAuditLog(entry: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const list = this.getAuditLogs();
    const newEvent: AuditEvent = {
      ...entry,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: getVenueCurrentDate().toISOString(),
    };
    list.unshift(newEvent);
    setItem(STORAGE_KEYS.AUDIT_LOGS, list);
    saveAuditLogToDb(newEvent);
  },

  // Reset to seed data
  resetToSeed(): void {
    localStorage.clear();
    notify();
  },
};

// Initialize Cloud Database Connection & Live Realtime Sync
let hasInitializedSync = false;

export async function initDatabaseSync(): Promise<void> {
  if (hasInitializedSync) return;
  hasInitializedSync = true;

  try {
    // 1. Test connection to Firestore
    await testConnection();

    // 2. Seed initial cloud data if newly created collection
    await seedInitialFirestoreData({
      members: clubStore.getMembers(),
      visits: clubStore.getVisits(),
      incidents: clubStore.getIncidents(),
    });

    // 3. Set up two-way real-time Firestore listeners
    setupFirestoreRealtimeListeners({
      onMembersUpdate: (remoteMembers) => {
        if (remoteMembers && remoteMembers.length > 0) {
          const local = clubStore.getMembers();
          // Merge remote members with local
          const merged = [...local];
          remoteMembers.forEach((rm) => {
            const idx = merged.findIndex((m) => m.id === rm.id);
            if (idx >= 0) {
              merged[idx] = rm;
            } else {
              merged.unshift(rm);
            }
          });
          setItem(STORAGE_KEYS.MEMBERS, merged);
          notify();
        }
      },
      onVisitsUpdate: (remoteVisits) => {
        if (remoteVisits && remoteVisits.length > 0) {
          const local = clubStore.getVisits();
          const merged = [...local];
          remoteVisits.forEach((rv) => {
            const idx = merged.findIndex((v) => v.id === rv.id);
            if (idx >= 0) {
              merged[idx] = rv;
            } else {
              merged.unshift(rv);
            }
          });
          setItem(STORAGE_KEYS.VISITS, merged);
          notify();
        }
      },
      onIncidentsUpdate: (remoteIncidents) => {
        if (remoteIncidents && remoteIncidents.length > 0) {
          const local = clubStore.getIncidents();
          const merged = [...local];
          remoteIncidents.forEach((ri) => {
            const idx = merged.findIndex((i) => i.id === ri.id);
            if (idx >= 0) {
              merged[idx] = ri;
            } else {
              merged.unshift(ri);
            }
          });
          setItem(STORAGE_KEYS.INCIDENTS, merged);
          notify();
        }
      },
    });
  } catch (err) {
    console.warn('[Firestore] Realtime sync init error:', err);
  }
}

// Auto-run sync on browser boot
if (typeof window !== 'undefined') {
  initDatabaseSync();
}

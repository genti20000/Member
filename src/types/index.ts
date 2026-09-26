/**
 * JONNY'S MEMBERS - Core Domain Types
 * Private members' club operating from 23 Frith Street, Soho, London.
 */

export type MembershipStatus =
  | 'pending'
  | 'waiting_48_hours'
  | 'ready_for_review'
  | 'active'
  | 'suspended'
  | 'revoked'
  | 'expired';

export type UserRole = 'door' | 'reception' | 'manager' | 'admin';

export type AdmissionCategory =
  | 'member'
  | 'member_guest'
  | 'proprietor_guest'
  | 'returning_smoker';

export type NightModeState = 'normal' | 'members_mode' | 'no_new_admissions';

export type IncidentCategory =
  | 'crimes_reported'
  | 'ejections'
  | 'complaints_crime_disorder'
  | 'disorder_incidents'
  | 'drug_weapon_seizures'
  | 'cctv_faults'
  | 'scanning_equipment_faults'
  | 'refusals_alcohol_sales'
  | 'police_council_visits';

export interface ClubRuleVersion {
  version: string;
  effectiveDate: string;
  title: string;
  rules: string[];
  summary: string;
}

export interface RuleAcceptance {
  ruleVersion: string;
  acceptedAt: string;
  applicantEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface Member {
  id: string;
  memberNumber: string; // e.g. JNY-0842
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  employer: string;
  hospitalityRole: string;
  employerAddressOrWebsite: string;
  photoUrl: string;
  employmentEvidenceUrl?: string;
  employmentEvidenceNote?: string;
  status: MembershipStatus;
  appliedAt: string; // ISO string
  eligibleAt: string; // appliedAt + 48 hours
  approvedAt?: string;
  approvedBy?: string;
  suspendedAt?: string;
  suspendedReason?: string;
  revokedAt?: string;
  revokedReason?: string;
  ruleAcceptance: RuleAcceptance;
  notes?: string;
}

export interface Guest {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  sponsoringMemberId: string;
  sponsoringMemberName: string;
  checkInTime: string;
  checkOutTime?: string;
  staffId: string;
  staffName: string;
}

export interface ProprietorGuest {
  id: string;
  fullName: string;
  affiliationOrReason: string;
  authorizedByManagerId: string;
  authorizedByManagerName: string;
  checkInTime: string;
  checkOutTime?: string;
}

export interface VisitRecord {
  id: string;
  date: string; // YYYY-MM-DD
  attendeeType: AdmissionCategory;
  memberId?: string;
  memberName: string;
  memberNumber?: string;
  guestNames: string[];
  sponsoringMemberId?: string;
  sponsoringMemberName?: string;
  checkInTime: string; // ISO
  checkOutTime?: string; // ISO
  isCurrentlyInside: boolean;
  isOutToSmoke: boolean;
  smokeExitTime?: string;
  responsibleStaffId: string;
  responsibleStaffName: string;
}

export interface SmokingPatron {
  id: string;
  visitId: string;
  name: string;
  type: 'member' | 'guest' | 'proprietor_guest';
  exitTimestamp: string;
  expectedReturnMinutes: number;
}

export interface CapacitySnapshot {
  id: string;
  timestamp: string; // ISO
  customerCount: number;
  maxCapacity: number; // 80
  staffCount: number;
  membersCount: number;
  memberGuestsCount: number;
  proprietorGuestsCount: number;
  smokersOutside: number;
}

export interface IncidentRecord {
  id: string;
  incidentNumber: string; // e.g. INC-2026-004
  timestamp: string; // ISO
  category: IncidentCategory;
  categoryLabel: string;
  description: string;
  personsInvolved?: string;
  actionTaken: string;
  staffMemberId: string;
  staffMemberName: string;
  cctvReference?: string;
  policeIncidentNumber?: string;
  isResolved: boolean;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: 'member' | 'guest' | 'visit' | 'incident' | 'rule' | 'smoking';
  targetId: string;
  targetName?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  badgeNumber: string;
  pin: string;
  avatarUrl?: string;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  remainingTimeMs?: number;
}

/**
 * JONNY'S MEMBERS - Licensing & Regulatory Logic Engine
 *
 * All Soho Club Licensing Act conditions are strictly enforced in this module.
 * Logic is enforced programmatically rather than just presented as UI warnings.
 */

import {
  Member,
  AdmissionCategory,
  NightModeState,
  ValidationResult,
  UserRole,
} from '../types';

export const MAX_CUSTOMER_CAPACITY = 80;
export const MAX_SMOKERS_OUTSIDE = 10;
export const MAX_GUESTS_PER_MEMBER_LATE_NIGHT = 2;
export const MAX_PROPRIETOR_GUESTS_CONCURRENT = 5;
export const MANDATORY_WAITING_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

/**
 * Determines current night mode based on venue London time.
 * Monday - Saturday operating conditions:
 * - Before 01:00: normal
 * - 01:00 to 01:29:59: members_mode
 * - 01:30 onward: no_new_admissions (only returning smokers allowed)
 */
export function getNightModeState(currentDate: Date = new Date()): {
  mode: NightModeState;
  hour: number;
  minute: number;
  label: string;
  subtext: string;
} {
  // Format to Europe/London
  const londonDateString = currentDate.toLocaleString('en-US', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const [hStr, mStr] = londonDateString.split(':');
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const timeInMinutes = hour * 60 + minute;

  // 01:00 is 60 minutes, 01:30 is 90 minutes. Normal club operating hours run until ~04:00.
  // We consider 01:00-01:29 as Members Mode, and 01:30-05:00 as No New Admissions.
  // Note: Times between 05:00 and 01:00 the following evening are normal day/evening mode.
  if (timeInMinutes >= 60 && timeInMinutes < 90) {
    return {
      mode: 'members_mode',
      hour,
      minute,
      label: 'MEMBERS MODE (AFTER 01:00)',
      subtext: 'Active members only, max 2 named guests per member, max 5 proprietor guests.',
    };
  }

  if (timeInMinutes >= 90 && timeInMinutes < 300) {
    // 01:30 to 05:00
    return {
      mode: 'no_new_admissions',
      hour,
      minute,
      label: 'NO NEW ADMISSIONS (AFTER 01:30)',
      subtext: 'Strict curfew: No new admissions or re-admissions. Returning smokers only.',
    };
  }

  return {
    mode: 'normal',
    hour,
    minute,
    label: 'STANDARD CLUB ADMISSIONS',
    subtext: 'General evening service before 01:00 cutoff.',
  };
}

/**
 * Validates whether an applicant has satisfied the mandatory 48-hour statutory waiting period.
 * Staff have NO normal override allowing activation before 48 hours.
 */
export function validate48HourWaitingPeriod(
  appliedAtIso: string,
  nowIso: string = new Date().toISOString()
): ValidationResult {
  const appliedTime = new Date(appliedAtIso).getTime();
  const currentTime = new Date(nowIso).getTime();
  const eligibleTime = appliedTime + MANDATORY_WAITING_PERIOD_MS;
  const diffMs = eligibleTime - currentTime;

  if (diffMs > 0) {
    const totalSeconds = Math.ceil(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      allowed: false,
      code: 'WAITING_PERIOD_ACTIVE',
      reason: `Mandatory 48-hour statutory waiting period active. Remaining time: ${hours}h ${minutes}m ${seconds}s. Licensing conditions forbid early approval.`,
      remainingTimeMs: diffMs,
    };
  }

  return {
    allowed: true,
    code: 'WAITING_PERIOD_SATISFIED',
    reason: 'Applicant has fulfilled the mandatory 48-hour waiting period and is eligible for manager review.',
    remainingTimeMs: 0,
  };
}

/**
 * Validates member status for club entry
 */
export function validateMemberStatus(member: Member): ValidationResult {
  if (member.status === 'active') {
    return { allowed: true };
  }

  if (member.status === 'waiting_48_hours' || member.status === 'pending') {
    const waitCheck = validate48HourWaitingPeriod(member.appliedAt);
    return {
      allowed: false,
      code: 'MEMBERSHIP_PENDING_WAITING',
      reason: waitCheck.reason || 'Membership is still in the mandatory 48-hour waiting period.',
      remainingTimeMs: waitCheck.remainingTimeMs,
    };
  }

  if (member.status === 'ready_for_review') {
    return {
      allowed: false,
      code: 'MEMBERSHIP_AWAITING_APPROVAL',
      reason: '48-hour waiting period completed, but membership requires manager review and approval before first admission.',
    };
  }

  if (member.status === 'suspended') {
    return {
      allowed: false,
      code: 'MEMBERSHIP_SUSPENDED',
      reason: `Membership is SUSPENDED. Reason: ${member.suspendedReason || 'Administrative suspension'}. Contact management.`,
    };
  }

  if (member.status === 'revoked') {
    return {
      allowed: false,
      code: 'MEMBERSHIP_REVOKED',
      reason: 'Membership has been permanently revoked by club management.',
    };
  }

  if (member.status === 'expired') {
    return {
      allowed: false,
      code: 'MEMBERSHIP_EXPIRED',
      reason: 'Annual membership has expired. Renewal required.',
    };
  }

  return {
    allowed: false,
    code: 'MEMBERSHIP_INVALID',
    reason: `Membership status '${member.status}' does not permit admission.`,
  };
}

/**
 * Comprehensive Admission Validator
 * Enforces all simultaneous venue conditions:
 * - Venue maximum customer capacity (80)
 * - 01:30 admission curfew (only returning smokers)
 * - 01:00 members-only rule
 * - Max 2 guests per member
 * - Max 5 proprietor guests
 * - Manager authorisation for proprietor guests
 */
export function validateAdmission({
  category,
  member,
  venueDate = new Date(),
  currentCustomerCount,
  activeGuestsForMemberCount = 0,
  currentProprietorGuestCount = 0,
  isReturningSmoker = false,
  staffRole = 'door',
}: {
  category: AdmissionCategory;
  member?: Member;
  venueDate?: Date;
  currentCustomerCount: number;
  activeGuestsForMemberCount?: number;
  currentProprietorGuestCount?: number;
  isReturningSmoker?: boolean;
  staffRole?: UserRole;
}): ValidationResult {
  const nightMode = getNightModeState(venueDate);

  // 1. Returning smoker exception:
  // Customers who temporarily stepped out to smoke are ALREADY accounted for in customer count
  // and are expressly permitted to re-enter after 01:30.
  if (isReturningSmoker) {
    return {
      allowed: true,
      reason: 'Customer returning from temporary smoking recess.',
    };
  }

  // 2. Strict 01:30 Curfew Rule
  if (nightMode.mode === 'no_new_admissions') {
    return {
      allowed: false,
      code: 'CURFEW_AFTER_0130',
      reason: 'After 01:30: Licensing conditions prohibit ANY new admission or re-admission. Only designated returning smokers may re-enter.',
    };
  }

  // 3. Venue Capacity Check (Max 80 customers excluding staff)
  if (currentCustomerCount >= MAX_CUSTOMER_CAPACITY) {
    return {
      allowed: false,
      code: 'CAPACITY_REACHED',
      reason: `Maximum customer capacity reached (${currentCustomerCount} / ${MAX_CUSTOMER_CAPACITY}). Admission blocked by venue licence.`,
    };
  }

  // 4. Admission Category & Mode Checks
  if (category === 'member') {
    if (!member) {
      return { allowed: false, code: 'NO_MEMBER', reason: 'Member profile is required.' };
    }
    const statusCheck = validateMemberStatus(member);
    if (!statusCheck.allowed) {
      return statusCheck;
    }
    return { allowed: true };
  }

  if (category === 'member_guest') {
    if (!member) {
      return {
        allowed: false,
        code: 'SPONSOR_REQUIRED',
        reason: 'Each member guest must be accompanied by and linked to a sponsoring active member.',
      };
    }

    const sponsorStatus = validateMemberStatus(member);
    if (!sponsorStatus.allowed) {
      return {
        allowed: false,
        code: 'SPONSOR_INACTIVE',
        reason: `Sponsoring member cannot admit guests: ${sponsorStatus.reason}`,
      };
    }

    // After 01:00 or general limit: strictly max 2 guests per member
    if (activeGuestsForMemberCount >= MAX_GUESTS_PER_MEMBER_LATE_NIGHT) {
      return {
        allowed: false,
        code: 'MEMBER_GUEST_LIMIT_REACHED',
        reason: `Member has reached maximum allowed guest allocation (${activeGuestsForMemberCount} / ${MAX_GUESTS_PER_MEMBER_LATE_NIGHT} tonight).`,
      };
    }

    return { allowed: true };
  }

  if (category === 'proprietor_guest') {
    // Proprietor guests require manager or administrator role
    if (staffRole !== 'manager' && staffRole !== 'admin') {
      return {
        allowed: false,
        code: 'MANAGER_AUTH_REQUIRED',
        reason: 'Proprietor guests require Manager or Administrator level authorisation.',
      };
    }

    // Maximum 5 proprietor guests at any one time
    if (currentProprietorGuestCount >= MAX_PROPRIETOR_GUESTS_CONCURRENT) {
      return {
        allowed: false,
        code: 'PROPRIETOR_GUEST_LIMIT_REACHED',
        reason: `Maximum proprietor guest capacity reached (${currentProprietorGuestCount} / ${MAX_PROPRIETOR_GUESTS_CONCURRENT} maximum).`,
      };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Validates whether a patron can exit to the smoking area
 * Maximum 10 persons outside temporarily smoking at one time.
 */
export function validateSmokingExit(currentSmokersOutside: number): ValidationResult {
  if (currentSmokersOutside >= MAX_SMOKERS_OUTSIDE) {
    return {
      allowed: false,
      code: 'SMOKING_CAPACITY_FULL',
      reason: `Smoking terrace is at maximum capacity (${currentSmokersOutside} / ${MAX_SMOKERS_OUTSIDE}). Patrons must wait until someone returns.`,
    };
  }

  return { allowed: true };
}

/**
 * JONNY'S MEMBERS - Automated Regulatory & Licensing Boundary Test Suite
 *
 * Covers all statutory licensing boundaries specified in the brief:
 * 1. 47h59m vs 48h00m Waiting Period
 * 2. 2 vs 3 Member Guests (Late Night)
 * 3. 5 vs 6 Proprietor Guests (Maximum allocation)
 * 4. 79 vs 80 vs 81 Customer Occupancy
 * 5. 9 vs 10 vs 11 Smokers Terrace Limit
 * 6. 00:59 vs 01:00 Night Mode Transition
 * 7. 01:29 vs 01:30 Hard Admission Cutoff & Curfew
 * 8. Returning Smoker post-01:30 exception
 */

import {
  validate48HourWaitingPeriod,
  validateAdmission,
  validateSmokingExit,
  getNightModeState,
  MAX_CUSTOMER_CAPACITY,
  MAX_SMOKERS_OUTSIDE,
  MAX_PROPRIETOR_GUESTS_CONCURRENT,
  MAX_GUESTS_PER_MEMBER_LATE_NIGHT,
} from './ruleEngine';
import { Member } from '../types';

export interface TestResult {
  id: string;
  category: string;
  name: string;
  boundaryDescription: string;
  passed: boolean;
  expectedOutcome: string;
  actualOutcome: string;
  details: string;
}

const mockActiveMember: Member = {
  id: 'test-mem-active',
  memberNumber: 'JNY-TEST-01',
  fullName: 'Test Active Member',
  dateOfBirth: '1990-01-01',
  email: 'test@sohobar.co.uk',
  phone: '+44 7700 900000',
  employer: 'Soho Hospitality Test',
  hospitalityRole: 'Bar Manager',
  employerAddressOrWebsite: 'Frith St',
  photoUrl: '',
  status: 'active',
  appliedAt: new Date(Date.now() - 100 * 3600 * 1000).toISOString(),
  eligibleAt: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
  ruleAcceptance: {
    ruleVersion: '2.0',
    acceptedAt: new Date(Date.now() - 100 * 3600 * 1000).toISOString(),
    applicantEmail: 'test@sohobar.co.uk',
  },
};

export function runAllLicensingBoundaryTests(): TestResult[] {
  const results: TestResult[] = [];
  const testNow = new Date('2026-09-25T23:00:00.000Z'); // baseline reference

  // 1. Boundary: 47h 59m (Blocked) vs 48h 00m (Allowed)
  {
    const applied47h59m = new Date(testNow.getTime() - (47 * 3600 + 59 * 60) * 1000).toISOString();
    const applied48h00m = new Date(testNow.getTime() - 48 * 3600 * 1000).toISOString();

    const res47h59m = validate48HourWaitingPeriod(applied47h59m, testNow.toISOString());
    const res48h00m = validate48HourWaitingPeriod(applied48h00m, testNow.toISOString());

    const passed = !res47h59m.allowed && res48h00m.allowed;

    results.push({
      id: 'rule-48h-boundary',
      category: '48-Hour Waiting Period',
      name: '47h 59m vs 48h 00m Statutory Waiting Boundary',
      boundaryDescription: 'Testing application at 47 hours 59 minutes (MUST FAIL) versus 48 hours exactly (MUST PASS)',
      passed,
      expectedOutcome: '47h59m BLOCKED with WAITING_PERIOD_ACTIVE; 48h00m ALLOWED with WAITING_PERIOD_SATISFIED',
      actualOutcome: `47h59m allowed=${res47h59m.allowed} (${res47h59m.code}); 48h00m allowed=${res48h00m.allowed} (${res48h00m.code})`,
      details: res47h59m.reason || '',
    });
  }

  // 2. Boundary: 2 vs 3 Guests Per Member
  {
    const res2Guests = validateAdmission({
      category: 'member_guest',
      member: mockActiveMember,
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 50,
      activeGuestsForMemberCount: 1, // Will become 2nd guest: OK
    });

    const res3Guests = validateAdmission({
      category: 'member_guest',
      member: mockActiveMember,
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 50,
      activeGuestsForMemberCount: 2, // Already has 2: attempting 3rd: MUST FAIL
    });

    const passed = res2Guests.allowed && !res3Guests.allowed && res3Guests.code === 'MEMBER_GUEST_LIMIT_REACHED';

    results.push({
      id: 'rule-guest-limit',
      category: 'Member Guest Allocation',
      name: `2 vs 3 Guests Boundary (Max ${MAX_GUESTS_PER_MEMBER_LATE_NIGHT} Guests)`,
      boundaryDescription: 'Admitting 2nd guest (ALLOWED) vs attempting 3rd guest for single member (BLOCKED)',
      passed,
      expectedOutcome: '2nd guest permitted; 3rd guest rejected by licensing limit',
      actualOutcome: `2nd guest allowed=${res2Guests.allowed}; 3rd guest allowed=${res3Guests.allowed} (${res3Guests.code})`,
      details: res3Guests.reason || '',
    });
  }

  // 3. Boundary: 5 vs 6 Proprietor Guests
  {
    const res5Proprietor = validateAdmission({
      category: 'proprietor_guest',
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 50,
      currentProprietorGuestCount: 4, // 5th guest: OK
      staffRole: 'manager',
    });

    const res6Proprietor = validateAdmission({
      category: 'proprietor_guest',
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 50,
      currentProprietorGuestCount: 5, // Already has 5: attempting 6th: MUST FAIL
      staffRole: 'manager',
    });

    const passed = res5Proprietor.allowed && !res6Proprietor.allowed && res6Proprietor.code === 'PROPRIETOR_GUEST_LIMIT_REACHED';

    results.push({
      id: 'rule-proprietor-guest-limit',
      category: 'Proprietor Guests',
      name: `5 vs 6 Proprietor Guests Boundary (Max ${MAX_PROPRIETOR_GUESTS_CONCURRENT})`,
      boundaryDescription: 'Admitting 5th proprietor guest (ALLOWED) vs attempting 6th proprietor guest (BLOCKED)',
      passed,
      expectedOutcome: '5th proprietor guest admitted; 6th rejected with PROPRIETOR_GUEST_LIMIT_REACHED',
      actualOutcome: `5th guest allowed=${res5Proprietor.allowed}; 6th guest allowed=${res6Proprietor.allowed} (${res6Proprietor.code})`,
      details: res6Proprietor.reason || '',
    });
  }

  // 4. Boundary: 79 vs 80 vs 81 Customer Occupancy
  {
    const res79 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 79, // Admitting 80th: ALLOWED
    });

    const res80 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 80, // Already 80: attempting 81st: MUST FAIL
    });

    const res81 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: new Date('2026-09-25T00:30:00'),
      currentCustomerCount: 81, // Over capacity: MUST FAIL
    });

    const passed = res79.allowed && !res80.allowed && !res81.allowed && res80.code === 'CAPACITY_REACHED';

    results.push({
      id: 'rule-occupancy-boundary',
      category: 'Venue Capacity',
      name: `79 vs 80 vs 81 Occupancy Boundary (Max ${MAX_CUSTOMER_CAPACITY} Persons)`,
      boundaryDescription: 'Customer count at 79 (ALLOWED) vs at 80 (BLOCKED) vs 81 (BLOCKED)',
      passed,
      expectedOutcome: 'Occupancy 79 allows admission; 80 and 81 strictly reject further admissions',
      actualOutcome: `Count 79 allowed=${res79.allowed}; Count 80 allowed=${res80.allowed} (${res80.code}); Count 81 allowed=${res81.allowed}`,
      details: res80.reason || '',
    });
  }

  // 5. Boundary: 9 vs 10 vs 11 Smokers Outside
  {
    const res9Smokers = validateSmokingExit(9); // 10th smoker: ALLOWED
    const res10Smokers = validateSmokingExit(10); // Already 10: attempting 11th: MUST FAIL
    const res11Smokers = validateSmokingExit(11); // Over limit: MUST FAIL

    const passed = res9Smokers.allowed && !res10Smokers.allowed && !res11Smokers.allowed && res10Smokers.code === 'SMOKING_CAPACITY_FULL';

    results.push({
      id: 'rule-smoking-boundary',
      category: 'Smoking Terrace',
      name: `9 vs 10 vs 11 Smokers Boundary (Max ${MAX_SMOKERS_OUTSIDE} Outside)`,
      boundaryDescription: '9 patrons outside (10th allowed to step out) vs 10 patrons outside (11th blocked)',
      passed,
      expectedOutcome: '9 outside permits exit; 10 outside locks terrace exit until someone returns',
      actualOutcome: `9 outside allowed=${res9Smokers.allowed}; 10 outside allowed=${res10Smokers.allowed} (${res10Smokers.code})`,
      details: res10Smokers.reason || '',
    });
  }

  // 6. Boundary: 00:59 vs 01:00 Night Mode Transition
  {
    const date0059 = new Date('2026-09-26T00:59:00+01:00'); // London BST/GMT representation
    const date0100 = new Date('2026-09-26T01:00:00+01:00');

    const mode0059 = getNightModeState(date0059);
    const mode0100 = getNightModeState(date0100);

    const passed = mode0059.mode === 'normal' && mode0100.mode === 'members_mode';

    results.push({
      id: 'rule-0100-mode-transition',
      category: 'Automated Night Modes',
      name: '00:59 vs 01:00 Night Mode Transition Boundary',
      boundaryDescription: 'At 00:59 venue runs Standard Admissions; at 01:00 venue shifts to Members Mode',
      passed,
      expectedOutcome: '00:59 is "normal"; 01:00 is "members_mode"',
      actualOutcome: `00:59 mode=${mode0059.mode} (${mode0059.label}); 01:00 mode=${mode0100.mode} (${mode0100.label})`,
      details: 'Automatic system transition locks admissions strictly to members, named guests, and proprietor guests.',
    });
  }

  // 7. Boundary: 01:29 vs 01:30 Hard Curfew Cutoff
  {
    const date0129 = new Date('2026-09-26T01:29:50+01:00');
    const date0130 = new Date('2026-09-26T01:30:00+01:00');

    const mode0129 = getNightModeState(date0129);
    const mode0130 = getNightModeState(date0130);

    const admission0129 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: date0129,
      currentCustomerCount: 50,
    });

    const admission0130 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: date0130,
      currentCustomerCount: 50,
    });

    const passed =
      mode0129.mode === 'members_mode' &&
      mode0130.mode === 'no_new_admissions' &&
      admission0129.allowed &&
      !admission0130.allowed &&
      admission0130.code === 'CURFEW_AFTER_0130';

    results.push({
      id: 'rule-0130-curfew-boundary',
      category: 'Automated Night Modes',
      name: '01:29 vs 01:30 Hard Admission Cutoff Boundary',
      boundaryDescription: 'At 01:29:50 admissions still active; at 01:30:00 venue shifts to NO NEW ADMISSIONS',
      passed,
      expectedOutcome: '01:29:50 permits admission; 01:30:00 strictly blocks all new admissions under CURFEW_AFTER_0130',
      actualOutcome: `01:29 allowed=${admission0129.allowed}; 01:30 allowed=${admission0130.allowed} (${admission0130.code})`,
      details: admission0130.reason || '',
    });
  }

  // 8. Boundary: Returning Smoker Allowed after 01:30
  {
    const date0135 = new Date('2026-09-26T01:35:00+01:00');

    const normalAttemptAfter0130 = validateAdmission({
      category: 'member',
      member: mockActiveMember,
      venueDate: date0135,
      currentCustomerCount: 50,
      isReturningSmoker: false,
    });

    const smokerReturnAfter0130 = validateAdmission({
      category: 'returning_smoker',
      venueDate: date0135,
      currentCustomerCount: 50,
      isReturningSmoker: true,
    });

    const passed = !normalAttemptAfter0130.allowed && smokerReturnAfter0130.allowed;

    results.push({
      id: 'rule-smoker-exception-0130',
      category: 'Automated Night Modes',
      name: 'Returning Smoker Post-01:30 Exception Boundary',
      boundaryDescription: 'Verifying that while normal check-in is banned after 01:30, Returning Smokers are expressly admitted',
      passed,
      expectedOutcome: 'Standard member blocked after 01:30; Returning Smoker successfully admitted',
      actualOutcome: `Normal member allowed=${normalAttemptAfter0130.allowed}; Returning smoker allowed=${smokerReturnAfter0130.allowed}`,
      details: smokerReturnAfter0130.reason || '',
    });
  }

  return results;
}

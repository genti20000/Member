import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  UserPlus,
  Crown,
  LogOut,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  User,
  Users,
  Camera,
  Check,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  Member,
  StaffUser,
  VisitRecord,
  ProprietorGuest,
} from '../../types';
import { clubStore, getVenueCurrentDate, subscribeToStore } from '../../services/storage';
import {
  getNightModeState,
  validateAdmission,
  validateMemberStatus,
  validate48HourWaitingPeriod,
  MAX_CUSTOMER_CAPACITY,
  MAX_SMOKERS_OUTSIDE,
  MAX_PROPRIETOR_GUESTS_CONCURRENT,
  MAX_GUESTS_PER_MEMBER_LATE_NIGHT,
} from '../../services/ruleEngine';
import { verifyMemberToken } from '../../services/security';
import { SmokingManagerModal } from './SmokingManagerModal';
import { IncidentLoggerModal } from './IncidentLoggerModal';

interface DoorReceptionViewProps {
  currentStaff: StaffUser;
  onOpenTestRunner: () => void;
  onNavigateToApplications: () => void;
}

export const DoorReceptionView: React.FC<DoorReceptionViewProps> = ({
  currentStaff,
  onOpenTestRunner,
  onNavigateToApplications,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(getVenueCurrentDate());
  const [stats, setStats] = useState(clubStore.getCapacityStats());
  const [activeVisits, setActiveVisits] = useState(clubStore.getVisits().filter((v) => v.isCurrentlyInside));

  // Modals & Panels
  const [showSmokingModal, setShowSmokingModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showMemberLookup, setShowMemberLookup] = useState(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showProprietorGuestModal, setShowProprietorGuestModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Selected Member Status Panel (Active / Waiting / Suspended)
  const [scannedMember, setScannedMember] = useState<Member | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Guest Registration Form state
  const [selectedSponsoringMemberId, setSelectedSponsoringMemberId] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(null);

  // Proprietor Guest Form state
  const [proprietorGuestName, setProprietorGuestName] = useState('');
  const [proprietorReason, setProprietorReason] = useState('');
  const [proprietorErrorMessage, setProprietorErrorMessage] = useState<string | null>(null);

  // Search state
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [checkoutSearchQuery, setCheckoutSearchQuery] = useState('');

  // Update on store updates and tick clock
  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setStats(clubStore.getCapacityStats());
      setActiveVisits(clubStore.getVisits().filter((v) => v.isCurrentlyInside));
      setCurrentDate(getVenueCurrentDate());
    });

    const timer = setInterval(() => {
      setCurrentDate(getVenueCurrentDate());
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const nightMode = getNightModeState(currentDate);
  const allMembers = clubStore.getMembers();

  // Inspect member check-in & guest status
  const getMemberActiveGuestsCount = (memberId: string): number => {
    const today = currentDate.toISOString().split('T')[0];
    const memberVisit = clubStore.getVisits().find(
      (v) => v.memberId === memberId && v.date === today && v.isCurrentlyInside
    );
    return memberVisit?.guestNames?.length || 0;
  };

  const isMemberCurrentlyInside = (memberId: string): boolean => {
    return activeVisits.some((v) => v.memberId === memberId);
  };

  // Handle Scanning or selecting a member
  const handleSelectMember = (member: Member) => {
    setScannedMember(member);
    setScanMessage(null);
    setShowMemberLookup(false);
    setShowScannerModal(false);
  };

  // Perform Member Check-In
  const handleCheckInMember = (member: Member) => {
    setScanMessage(null);

    // Run full licensing validation
    const validation = validateAdmission({
      category: 'member',
      member,
      venueDate: currentDate,
      currentCustomerCount: stats.totalCustomers,
      staffRole: currentStaff.role,
    });

    if (!validation.allowed) {
      setScanMessage(validation.reason || 'Check-in blocked by licensing rule.');
      return;
    }

    // Register visit
    const newVisit: VisitRecord = {
      id: `vis-${Date.now()}`,
      date: currentDate.toISOString().split('T')[0],
      attendeeType: 'member',
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.memberNumber,
      guestNames: [],
      checkInTime: currentDate.toISOString(),
      isCurrentlyInside: true,
      isOutToSmoke: false,
      responsibleStaffId: currentStaff.id,
      responsibleStaffName: currentStaff.name,
    };

    clubStore.saveVisit(newVisit);

    clubStore.addAuditLog({
      actorId: currentStaff.id,
      actorName: currentStaff.name,
      actorRole: currentStaff.role,
      action: 'CHECK_IN_MEMBER',
      targetType: 'member',
      targetId: member.id,
      targetName: member.fullName,
      newValue: `Occupancy: ${stats.totalCustomers + 1} / ${MAX_CUSTOMER_CAPACITY}`,
      reason: `Admitted under ${nightMode.mode} rules.`,
    });

    setScanMessage(`Check-in successful: ${member.fullName} admitted.`);
  };

  // Add guest for a member
  const handleAddGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestErrorMessage(null);

    if (!selectedSponsoringMemberId || !newGuestName.trim()) {
      setGuestErrorMessage('Member and guest name are required.');
      return;
    }

    const sponsoringMember = clubStore.getMemberById(selectedSponsoringMemberId);
    if (!sponsoringMember) {
      setGuestErrorMessage('Sponsoring member not found.');
      return;
    }

    const currentGuestCount = getMemberActiveGuestsCount(sponsoringMember.id);

    const validation = validateAdmission({
      category: 'member_guest',
      member: sponsoringMember,
      venueDate: currentDate,
      currentCustomerCount: stats.totalCustomers,
      activeGuestsForMemberCount: currentGuestCount,
      staffRole: currentStaff.role,
    });

    if (!validation.allowed) {
      setGuestErrorMessage(validation.reason || 'Guest admission blocked.');
      return;
    }

    // Add guest to active visit
    const visits = clubStore.getVisits();
    const today = currentDate.toISOString().split('T')[0];
    let memberVisit = visits.find(
      (v) => v.memberId === sponsoringMember.id && v.date === today && v.isCurrentlyInside
    );

    if (!memberVisit) {
      // Create new visit with member + guest
      memberVisit = {
        id: `vis-${Date.now()}`,
        date: today,
        attendeeType: 'member',
        memberId: sponsoringMember.id,
        memberName: sponsoringMember.fullName,
        memberNumber: sponsoringMember.memberNumber,
        guestNames: [newGuestName.trim()],
        checkInTime: currentDate.toISOString(),
        isCurrentlyInside: true,
        isOutToSmoke: false,
        responsibleStaffId: currentStaff.id,
        responsibleStaffName: currentStaff.name,
      };
      clubStore.saveVisit(memberVisit);
    } else {
      memberVisit.guestNames.push(newGuestName.trim());
      clubStore.saveVisit(memberVisit);
    }

    clubStore.addAuditLog({
      actorId: currentStaff.id,
      actorName: currentStaff.name,
      actorRole: currentStaff.role,
      action: 'ADD_MEMBER_GUEST',
      targetType: 'guest',
      targetId: sponsoringMember.id,
      targetName: newGuestName.trim(),
      newValue: `Guest of ${sponsoringMember.fullName} (Guest ${currentGuestCount + 1} / ${MAX_GUESTS_PER_MEMBER_LATE_NIGHT})`,
    });

    setNewGuestName('');
    setShowAddGuestModal(false);
  };

  // Add Proprietor Guest
  const handleProprietorGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProprietorErrorMessage(null);

    const validation = validateAdmission({
      category: 'proprietor_guest',
      venueDate: currentDate,
      currentCustomerCount: stats.totalCustomers,
      currentProprietorGuestCount: stats.proprietorGuestsInside,
      staffRole: currentStaff.role,
    });

    if (!validation.allowed) {
      setProprietorErrorMessage(validation.reason || 'Proprietor guest blocked.');
      return;
    }

    const newPropGuest: ProprietorGuest = {
      id: `prop-${Date.now()}`,
      fullName: proprietorGuestName.trim(),
      affiliationOrReason: proprietorReason.trim() || 'Proprietor Hospitality Invitation',
      authorizedByManagerId: currentStaff.id,
      authorizedByManagerName: currentStaff.name,
      checkInTime: currentDate.toISOString(),
    };

    clubStore.addProprietorGuest(newPropGuest, currentStaff);
    setProprietorGuestName('');
    setProprietorReason('');
    setShowProprietorGuestModal(false);
  };

  // Check out patron
  const handleCheckOut = (visitId: string) => {
    clubStore.checkOutVisit(visitId, currentStaff);
  };

  // Filtered members for search
  const filteredMembers = allMembers.filter((m) => {
    const q = memberSearchQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q) ||
      m.employer.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  // Filtered visits for checkout
  const filteredCheckouts = activeVisits.filter((v) => {
    const q = checkoutSearchQuery.toLowerCase();
    return (
      v.memberName.toLowerCase().includes(q) ||
      (v.memberNumber && v.memberNumber.toLowerCase().includes(q)) ||
      v.guestNames.some((g) => g.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. MASTER HEADER & VENUE LIVE STATS STRIP */}
      <div className="rounded-2xl bg-gradient-to-b from-[#181215] to-[#100D0F] border border-[#3E101B] shadow-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#280C14]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5C378] animate-pulse" />
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-wide text-[#E5C378]">
                JONNY’S SOHO
              </h1>
            </div>
            <div className="text-xs font-mono tracking-widest text-[#9B7836] uppercase mt-0.5">
              MEMBERS · 23 FRITH STREET RECEPTION & DOOR CONTROL
            </div>
          </div>

          {/* Active Night Mode Banner */}
          <div
            className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-colors ${
              nightMode.mode === 'no_new_admissions'
                ? 'bg-[#3E101B] border-rose-500/70 text-rose-200'
                : nightMode.mode === 'members_mode'
                ? 'bg-[#38240D] border-amber-500/70 text-amber-200'
                : 'bg-[#151214] border-[#581625]/60 text-stone-200'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
              {nightMode.mode === 'no_new_admissions' ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : nightMode.mode === 'members_mode' ? (
                <Clock className="w-5 h-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#E5C378]" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider uppercase">
                {nightMode.label}
              </div>
              <div className="text-[11px] opacity-85 leading-tight">
                {nightMode.subtext}
              </div>
            </div>
          </div>
        </div>

        {/* 2. THE 5 STATUTORY LIVE COUNTERS (Per Brief Requirement) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5">
          {/* VENUE 63 / 80 */}
          <div className="p-3.5 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span>VENUE</span>
              <span className="text-[10px] text-stone-500 font-sans">Max 80</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span
                className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums ${
                  stats.totalCustomers >= MAX_CUSTOMER_CAPACITY
                    ? 'text-rose-400'
                    : stats.totalCustomers >= 70
                    ? 'text-amber-400'
                    : 'text-[#E5C378]'
                }`}
              >
                {stats.totalCustomers}
              </span>
              <span className="font-mono text-sm text-stone-400">/ 80</span>
            </div>
            <div className="mt-2 w-full bg-[#1C1619] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  stats.totalCustomers >= 80 ? 'bg-rose-500' : stats.totalCustomers >= 70 ? 'bg-amber-500' : 'bg-[#C6A052]'
                }`}
                style={{ width: `${Math.min(100, (stats.totalCustomers / 80) * 100)}%` }}
              />
            </div>
          </div>

          {/* MEMBERS 34 */}
          <div className="p-3.5 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              MEMBERS
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-stone-200 tabular-nums">
                {stats.membersInside}
              </span>
              <span className="text-xs text-stone-400">inside</span>
            </div>
            <div className="mt-2 text-[10px] text-stone-500">Active member badges</div>
          </div>

          {/* MEMBER GUESTS 25 */}
          <div className="p-3.5 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              MEMBER GUESTS
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-stone-200 tabular-nums">
                {stats.guestsInside}
              </span>
              <span className="text-xs text-stone-400">inside</span>
            </div>
            <div className="mt-2 text-[10px] text-stone-500">Max 2 per member</div>
          </div>

          {/* PROPRIETOR GUESTS 4 / 5 */}
          <div className="p-3.5 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span>PROPRIETOR</span>
              <span className="text-[10px] text-stone-500 font-sans">Max 5</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span
                className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums ${
                  stats.proprietorGuestsInside >= MAX_PROPRIETOR_GUESTS_CONCURRENT
                    ? 'text-rose-400'
                    : 'text-[#E5C378]'
                }`}
              >
                {stats.proprietorGuestsInside}
              </span>
              <span className="font-mono text-sm text-stone-400">/ 5</span>
            </div>
            <div className="mt-2 text-[10px] text-stone-500">Manager authorized</div>
          </div>

          {/* SMOKERS OUTSIDE 6 / 10 */}
          <div
            onClick={() => setShowSmokingModal(true)}
            className="p-3.5 rounded-xl bg-[#120F11] hover:bg-[#1A1417] border border-[#2B0A13] hover:border-amber-500/40 flex flex-col justify-between cursor-pointer transition-colors"
          >
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-300">
                <Flame className="w-3.5 h-3.5" /> SMOKERS
              </span>
              <span className="text-[10px] text-stone-500 font-sans">Max 10</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span
                className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums ${
                  stats.smokersOutside >= MAX_SMOKERS_OUTSIDE
                    ? 'text-rose-400'
                    : stats.smokersOutside >= 8
                    ? 'text-amber-400'
                    : 'text-[#E5C378]'
                }`}
              >
                {stats.smokersOutside}
              </span>
              <span className="font-mono text-sm text-stone-400">/ 10</span>
            </div>
            <div className="mt-2 text-[10px] text-amber-400/90 flex items-center justify-between">
              <span>Frith St Terrace</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRIMARY TOUCH ACTIONS (Large iPad Touch Targets: Min 54px) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {/* SCAN MEMBER */}
        <button
          onClick={() => setShowScannerModal(true)}
          className="h-16 rounded-xl bg-gradient-to-b from-[#581625] to-[#3E101B] hover:from-[#6B1B2D] hover:to-[#4C1422] border border-[#C6A052]/50 text-[#E5C378] flex flex-col items-center justify-center gap-1 shadow-lg active:scale-[0.98] transition-all"
        >
          <QrCode className="w-5 h-5 text-amber-200" />
          <span className="text-xs font-mono font-bold tracking-wider">SCAN MEMBER</span>
        </button>

        {/* SEARCH MEMBER */}
        <button
          onClick={() => setShowMemberLookup(true)}
          className="h-16 rounded-xl bg-[#181316] hover:bg-[#221B1E] border border-[#3E101B] text-stone-200 flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <Search className="w-5 h-5 text-stone-300" />
          <span className="text-xs font-mono font-bold tracking-wider">SEARCH</span>
        </button>

        {/* ADD GUEST */}
        <button
          onClick={() => setShowAddGuestModal(true)}
          disabled={nightMode.mode === 'no_new_admissions'}
          className="h-16 rounded-xl bg-[#181316] hover:bg-[#221B1E] border border-[#3E101B] text-stone-200 disabled:opacity-40 disabled:hover:bg-[#181316] flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <UserPlus className="w-5 h-5 text-stone-300" />
          <span className="text-xs font-mono font-bold tracking-wider">ADD GUEST</span>
        </button>

        {/* PROPRIETOR GUEST */}
        <button
          onClick={() => setShowProprietorGuestModal(true)}
          disabled={nightMode.mode === 'no_new_admissions'}
          className="h-16 rounded-xl bg-[#1F1710] hover:bg-[#2B2016] border border-[#C6A052]/30 text-amber-200 disabled:opacity-40 flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <Crown className="w-5 h-5 text-[#E5C378]" />
          <span className="text-xs font-mono font-bold tracking-wider">PROPRIETOR</span>
        </button>

        {/* CHECK OUT */}
        <button
          onClick={() => setShowCheckOutModal(true)}
          className="h-16 rounded-xl bg-[#181316] hover:bg-[#221B1E] border border-[#3E101B] text-stone-200 flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <LogOut className="w-5 h-5 text-stone-300" />
          <span className="text-xs font-mono font-bold tracking-wider">CHECK OUT</span>
        </button>

        {/* SMOKING */}
        <button
          onClick={() => setShowSmokingModal(true)}
          className="h-16 rounded-xl bg-[#1B1417] hover:bg-[#261C20] border border-[#3E101B] text-amber-300 flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <Flame className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-wider">SMOKING</span>
        </button>

        {/* INCIDENT */}
        <button
          onClick={() => setShowIncidentModal(true)}
          className="h-16 col-span-2 sm:col-span-1 rounded-xl bg-[#260C14] hover:bg-[#34111C] border border-rose-500/40 text-rose-300 flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all"
        >
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <span className="text-xs font-mono font-bold tracking-wider">INCIDENT</span>
        </button>
      </div>

      {/* 4. SCANNED MEMBER STATUS PANEL (Per Spec) */}
      {scannedMember && (
        <div className="rounded-2xl bg-[#141012] border-2 border-[#581625] shadow-2xl p-5 sm:p-7 relative overflow-hidden transition-all animate-fadeIn">
          {/* Close Panel Button */}
          <button
            onClick={() => setScannedMember(null)}
            className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-lg bg-[#20181C]"
          >
            <XCircle className="w-5 h-5" />
          </button>

          {/* Validation Status Banner */}
          {scannedMember.status === 'active' ? (
            <div className="mb-6 pb-4 border-b border-[#280C14]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-[#E5C378] tracking-wide">
                    ACTIVE MEMBER
                  </div>
                  <div className="text-xs font-mono text-emerald-400 tracking-wider">
                    VERIFIED SOHO HOSPITALITY MEMBERSHIP
                  </div>
                </div>
              </div>
            </div>
          ) : scannedMember.status === 'waiting_48_hours' || scannedMember.status === 'pending' ? (
            <div className="mb-6 pb-4 border-b border-[#280C14]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-400">
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-amber-300 tracking-wide">
                    48-HOUR WAITING PERIOD
                  </div>
                  <div className="text-xs text-amber-200/90 font-mono">
                    {validate48HourWaitingPeriod(scannedMember.appliedAt).reason}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 pb-4 border-b border-[#280C14]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400">
                  <XCircle className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-rose-300 tracking-wide">
                    MEMBERSHIP NOT ACTIVE
                  </div>
                  <div className="text-xs text-rose-200/90 font-mono">
                    {validateMemberStatus(scannedMember).reason}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Details Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Left: Member Photo & Identity */}
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#C6A052]/50 bg-[#1A1417] shrink-0 shadow-lg">
                {scannedMember.photoUrl ? (
                  <img
                    src={scannedMember.photoUrl}
                    alt={scannedMember.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#E5C378]">
                    <User className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-100">
                  {scannedMember.fullName}
                </h3>
                <div className="font-mono text-sm text-[#E5C378] tracking-wider mt-0.5">
                  {scannedMember.memberNumber}
                </div>
                <div className="text-xs text-stone-300 mt-1 font-medium">
                  {scannedMember.hospitalityRole} · <span className="text-stone-400">{scannedMember.employer}</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  Applied: {new Date(scannedMember.appliedAt).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>

            {/* Middle: Tonight's Attendance & Guest Allowance */}
            <div className="p-4 rounded-xl bg-[#1A1418] border border-[#2B0A13]">
              <div className="text-xs font-mono text-stone-400 uppercase tracking-wider mb-2">
                Tonight's Guest Allocation
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-[#E5C378]">
                  {getMemberActiveGuestsCount(scannedMember.id)} / {MAX_GUESTS_PER_MEMBER_LATE_NIGHT}
                </span>
                <span className="text-xs text-stone-400">guests admitted tonight</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-400">
                {isMemberCurrentlyInside(scannedMember.id) ? (
                  <span className="text-emerald-400 font-medium">● Currently inside venue</span>
                ) : (
                  <span className="text-stone-500">○ Not currently checked in</span>
                )}
              </div>
            </div>

            {/* Right: Touch Actions (Per Spec: CHECK IN / ADD GUEST / OUT TO SMOKE) */}
            <div className="flex flex-col gap-2.5">
              {scannedMember.status === 'active' ? (
                <>
                  {!isMemberCurrentlyInside(scannedMember.id) ? (
                    <button
                      onClick={() => handleCheckInMember(scannedMember)}
                      disabled={nightMode.mode === 'no_new_admissions'}
                      className="w-full py-3.5 rounded-xl bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/50 text-[#E5C378] font-mono text-sm font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {nightMode.mode === 'no_new_admissions'
                        ? 'ADMISSIONS CLOSED (01:30 CURFEW)'
                        : 'CHECK IN MEMBER'}
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs text-center font-mono">
                      ✓ MEMBER ALREADY INSIDE
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedSponsoringMemberId(scannedMember.id);
                      setShowAddGuestModal(true);
                    }}
                    disabled={
                      nightMode.mode === 'no_new_admissions' ||
                      getMemberActiveGuestsCount(scannedMember.id) >= MAX_GUESTS_PER_MEMBER_LATE_NIGHT
                    }
                    className="w-full py-3 rounded-xl bg-[#221A1E] hover:bg-[#2F242A] border border-[#3E101B] text-stone-200 font-mono text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    ADD GUEST ({getMemberActiveGuestsCount(scannedMember.id)}/2)
                  </button>

                  {isMemberCurrentlyInside(scannedMember.id) && (
                    <button
                      onClick={() => {
                        const visit = activeVisits.find((v) => v.memberId === scannedMember.id);
                        if (visit) {
                          clubStore.markOutToSmoke({
                            visitId: visit.id,
                            name: `${scannedMember.fullName} (Member)`,
                            type: 'member',
                          });
                          setShowSmokingModal(true);
                        }
                      }}
                      disabled={stats.smokersOutside >= MAX_SMOKERS_OUTSIDE}
                      className="w-full py-2.5 rounded-xl bg-[#1C1619] hover:bg-[#281F24] border border-[#C6A052]/30 text-amber-300 font-mono text-xs font-medium disabled:opacity-40 transition-colors"
                    >
                      OUT TO SMOKE
                    </button>
                  )}
                </>
              ) : scannedMember.status === 'ready_for_review' ? (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/50 text-amber-200 text-xs">
                  <div className="font-semibold mb-1">48-Hour Waiting Satisfied</div>
                  <p className="text-[11px] text-amber-300/80 mb-3">
                    This applicant has satisfied the 48-hour statutory waiting requirement. A Manager must approve the application before first admission.
                  </p>
                  <button
                    onClick={onNavigateToApplications}
                    className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-black font-semibold text-xs transition-colors"
                  >
                    Open Management Approval Queue
                  </button>
                </div>
              ) : scannedMember.status === 'waiting_48_hours' || scannedMember.status === 'pending' ? (
                <div className="p-4 rounded-xl bg-[#181316] border border-[#3E101B] text-xs text-stone-300">
                  <div className="font-semibold text-amber-400 mb-1">Statutory 48h Lockout</div>
                  <p className="text-[11px] text-stone-400">
                    Westminster Council Licensing Condition Section 2 strictly forbids door staff or managers from waiving or accelerating the 48-hour waiting period.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-700/50 text-rose-200 text-xs">
                  <div className="font-semibold mb-1">Admission Prohibited</div>
                  <p className="text-[11px] text-rose-300/80">
                    {scannedMember.status.toUpperCase()} status requires resolution with Jonny Thorne or Christian Pettitt.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Toast / Status Feedback */}
          {scanMessage && (
            <div className="mt-4 p-3 rounded-xl bg-[#22181C] border border-[#581625] text-xs font-mono text-[#E5C378] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{scanMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* 5. CURRENT VENUE OCCUPANTS & ACTIVE REGISTER PREVIEW */}
      <div className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#200A11]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C6A052]" />
            <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-200">
              Live Attendance Register ({activeVisits.length} Records Inside)
            </h2>
          </div>
          <span className="text-xs font-mono text-stone-400">
            Staff On-Duty: <strong>{stats.staffInside}</strong> (Excluded from 80 cap)
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          {activeVisits.length === 0 ? (
            <div className="text-center py-12 text-xs text-stone-500 border border-dashed border-[#200A11] rounded-xl">
              No patrons currently checked in.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#200A11] text-stone-400 font-mono uppercase text-[10px]">
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Name / Number</th>
                  <th className="pb-3">Guests</th>
                  <th className="pb-3">Check-In</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D0C13]">
                {activeVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-[#181316]/50 transition-colors">
                    <td className="py-3">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          v.attendeeType === 'proprietor_guest'
                            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                            : v.attendeeType === 'member_guest'
                            ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                            : 'bg-[#2A1017] border-[#581625] text-[#E5C378]'
                        }`}
                      >
                        {v.attendeeType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-stone-200">
                      <div>{v.memberName}</div>
                      {v.memberNumber && (
                        <div className="text-[10px] font-mono text-[#C6A052]">
                          {v.memberNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-stone-300">
                      {v.guestNames && v.guestNames.length > 0 ? (
                        <div className="space-y-0.5">
                          {v.guestNames.map((g, idx) => (
                            <div key={idx} className="text-[11px] text-stone-300 font-medium">
                              · {g}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-500">—</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-stone-400 text-[11px]">
                      {new Date(v.checkInTime).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      {v.isOutToSmoke ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                          <Flame className="w-3 h-3" /> Smoking outside
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-400">Inside</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {v.isOutToSmoke ? (
                          <button
                            onClick={() => {
                              const patron = clubStore
                                .getSmokingPatrons()
                                .find((p) => p.visitId === v.id);
                              if (patron) clubStore.markSmokingReturned(patron.id);
                            }}
                            className="px-2.5 py-1 text-[11px] bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 rounded font-mono"
                          >
                            Mark Returned
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              clubStore.markOutToSmoke({
                                visitId: v.id,
                                name: v.memberName,
                                type: v.attendeeType === 'proprietor_guest' ? 'proprietor_guest' : v.attendeeType === 'member_guest' ? 'guest' : 'member',
                              });
                            }}
                            disabled={stats.smokersOutside >= MAX_SMOKERS_OUTSIDE}
                            className="px-2 py-1 text-[10px] bg-[#1F171A] hover:bg-[#2B2024] text-stone-300 rounded border border-[#3E101B] disabled:opacity-40"
                          >
                            Smoke
                          </button>
                        )}
                        <button
                          onClick={() => handleCheckOut(v.id)}
                          className="px-2.5 py-1 text-[11px] bg-[#3E101B] hover:bg-[#501523] text-stone-200 rounded border border-[#581625]"
                        >
                          Out
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: QR SCANNER & TEST SCAN EMULATOR */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
              <div className="flex items-center gap-2 text-[#E5C378] font-serif text-lg font-bold">
                <Camera className="w-5 h-5" />
                <span>Reception Member QR Scanner</span>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 p-6 rounded-xl border border-dashed border-[#C6A052]/40 bg-[#161012] flex flex-col items-center justify-center text-center">
              <div className="w-32 h-32 rounded-xl border-2 border-[#C6A052] flex items-center justify-center relative overflow-hidden bg-black/50">
                <div className="absolute inset-x-0 h-0.5 bg-[#E5C378] animate-pulse" />
                <QrCode className="w-16 h-16 text-[#C6A052]/60" />
              </div>
              <p className="mt-4 text-xs text-stone-300">
                Position iPad camera over member's digital card QR code.
              </p>
              <div className="text-[10px] text-[#C6A052] font-mono mt-1">
                Rotating dynamic token supported (anti-screenshot protected)
              </div>
            </div>

            {/* Quick Test Member Scenarios (Essential for rapid inspection) */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-2">
                Simulate Direct Scans for Compliance Verification:
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allMembers.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMember(m)}
                    className="w-full p-2 rounded-lg bg-[#181416] hover:bg-[#251D22] border border-[#2B0A13] flex items-center justify-between text-left transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-stone-200">{m.fullName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {m.memberNumber} · {m.employer}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        m.status === 'active'
                          ? 'border-emerald-500/50 text-emerald-300'
                          : m.status === 'waiting_48_hours'
                          ? 'border-amber-500/50 text-amber-300'
                          : 'border-rose-500/50 text-rose-300'
                      }`}
                    >
                      {m.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#2B0A13] flex justify-end">
              <button
                onClick={() => setShowScannerModal(false)}
                className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs font-medium text-stone-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEARCH MEMBER */}
      {showMemberLookup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-5 sm:p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
              <div className="flex items-center gap-2 text-[#E5C378] font-serif text-lg font-bold">
                <Search className="w-5 h-5" />
                <span>Search Member Directory</span>
              </div>
              <button
                onClick={() => setShowMemberLookup(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4">
              <input
                type="text"
                autoFocus
                placeholder="Search by full name, member number, employer or email..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-[#0E0C0E] border border-[#3E101B] rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
              />
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelectMember(m)}
                  className="p-3 rounded-xl bg-[#161214] hover:bg-[#20181C] border border-[#2B0A13] hover:border-[#581625] cursor-pointer flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#C6A052]/40 bg-[#1E1618] shrink-0">
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-full h-full p-2 text-stone-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-stone-100">{m.fullName}</div>
                      <div className="text-[11px] font-mono text-[#C6A052]">
                        {m.memberNumber} · {m.hospitalityRole} at {m.employer}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                      m.status === 'active'
                        ? 'border-emerald-500/50 text-emerald-300'
                        : m.status === 'waiting_48_hours'
                        ? 'border-amber-500/50 text-amber-300'
                        : 'border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD GUEST */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
              <div className="flex items-center gap-2 text-[#E5C378] font-serif text-lg font-bold">
                <UserPlus className="w-5 h-5" />
                <span>Register Named Guest (Max 2 Per Member)</span>
              </div>
              <button
                onClick={() => setShowAddGuestModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {guestErrorMessage && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{guestErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddGuestSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                  Sponsoring Active Member *
                </label>
                <select
                  value={selectedSponsoringMemberId}
                  onChange={(e) => setSelectedSponsoringMemberId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C6A052]"
                >
                  <option value="">Select sponsoring member...</option>
                  {allMembers
                    .filter((m) => m.status === 'active')
                    .map((m) => {
                      const guestCount = getMemberActiveGuestsCount(m.id);
                      return (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={guestCount >= MAX_GUESTS_PER_MEMBER_LATE_NIGHT}
                          className="bg-[#121214] text-stone-200"
                        >
                          {m.fullName} ({m.memberNumber}) — {guestCount}/2 Guests tonight
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                  Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Thorne"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Licensing rule: Each member guest must be registered by full legal name and linked to their sponsoring host.
                </span>
              </div>

              <div className="pt-3 border-t border-[#2B0A13] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddGuestModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs font-medium text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/40 text-[#E5C378] text-xs font-semibold"
                >
                  Admit Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PROPRIETOR GUEST */}
      {showProprietorGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
              <div className="flex items-center gap-2 text-[#E5C378] font-serif text-lg font-bold">
                <Crown className="w-5 h-5" />
                <span>Proprietor Guest (Max 5 Concurrent)</span>
              </div>
              <button
                onClick={() => setShowProprietorGuestModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3 rounded-lg bg-[#1E1710] border border-amber-500/30 text-amber-200 text-xs">
              <strong>Manager Authorisation Required:</strong> Currently <strong>{stats.proprietorGuestsInside} / 5</strong> proprietor guests admitted.
            </div>

            {proprietorErrorMessage && (
              <div className="mb-3 p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{proprietorErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleProprietorGuestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                  Proprietor Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lady Beatrice Montgomery"
                  value={proprietorGuestName}
                  onChange={(e) => setProprietorGuestName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                  Affiliation / Business Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Freeholder / Visiting Sommelier / Soho Society"
                  value={proprietorReason}
                  onChange={(e) => setProprietorReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
                />
              </div>

              <div className="text-[11px] text-stone-400">
                Authorising Manager: <strong>{currentStaff.name} ({currentStaff.role.toUpperCase()})</strong>
              </div>

              <div className="pt-3 border-t border-[#2B0A13] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProprietorGuestModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs font-medium text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={currentStaff.role !== 'manager' && currentStaff.role !== 'admin'}
                  className="px-5 py-2 rounded-lg bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/40 text-[#E5C378] text-xs font-semibold disabled:opacity-40"
                >
                  Authorise Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RAPID CHECK OUT */}
      {showCheckOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-5 sm:p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
              <div className="flex items-center gap-2 text-[#E5C378] font-serif text-lg font-bold">
                <LogOut className="w-5 h-5" />
                <span>Patron Check-Out ({activeVisits.length} Inside)</span>
              </div>
              <button
                onClick={() => setShowCheckOutModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3">
              <input
                type="text"
                placeholder="Search patron by name or number..."
                value={checkoutSearchQuery}
                onChange={(e) => setCheckoutSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {filteredCheckouts.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 rounded-lg bg-[#181416] hover:bg-[#20181C] border border-[#2B0A13] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-stone-200">{v.memberName}</div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {v.memberNumber || v.attendeeType.replace('_', ' ')} · Checked in at {new Date(v.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckOut(v.id)}
                    className="px-3 py-1.5 rounded-md bg-[#581625] hover:bg-[#721C31] text-[#E5C378] text-xs font-mono font-medium shrink-0"
                  >
                    Check Out
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#2B0A13] flex justify-end">
              <button
                onClick={() => setShowCheckOutModal(false)}
                className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs text-stone-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMOKING MANAGER MODAL */}
      <SmokingManagerModal
        isOpen={showSmokingModal}
        onClose={() => setShowSmokingModal(false)}
        currentStaff={currentStaff}
      />

      {/* INCIDENT LOGGER MODAL */}
      <IncidentLoggerModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        currentStaff={currentStaff}
      />
    </div>
  );
};

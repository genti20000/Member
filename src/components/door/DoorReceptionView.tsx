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
import { CameraQRScannerModal } from './CameraQRScannerModal';
import { FrontFacingQrScanner } from './FrontFacingQrScanner';
import { QrReader } from 'react-qr-reader';
import { parseMemberFromQRToken } from '../../services/security';

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

  // iPad Front-Camera Live Scanner Deck
  const [isKioskScannerActive, setIsKioskScannerActive] = useState(false);
  const [kioskScanFlash, setKioskScanFlash] = useState<'success' | 'failure' | null>(null);
  const [kioskFeedbackMessage, setKioskFeedbackMessage] = useState<string | null>(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'granted' | 'prompt' | 'denied' | 'checking'>('checking');

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

  // Check camera permissions respecting metadata.json ("camera" in requestFramePermissions)
  useEffect(() => {
    async function checkCameraPerm() {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermissionStatus(status.state as 'granted' | 'prompt' | 'denied');
          status.onchange = () => {
            setCameraPermissionStatus(status.state as 'granted' | 'prompt' | 'denied');
          };
        } catch {
          setCameraPermissionStatus('prompt');
        }
      } else {
        setCameraPermissionStatus('prompt');
      }
    }
    checkCameraPerm();
  }, []);

  // Handle live QR code scanning directly from iPad front-facing camera via react-qr-reader
  const handleLiveQrScanned = (rawText: string) => {
    if (!rawText) return;
    const members = clubStore.getMembers();
    const tokenResult = parseMemberFromQRToken(rawText, members);

    let memberMatch: Member | null = null;
    let isValid = false;

    if (tokenResult.valid && tokenResult.member) {
      const found = tokenResult.member as Member;
      memberMatch = found;
      isValid = found.status === 'active';
    } else {
      const direct = members.find(
        (m) =>
          m.id.toLowerCase() === rawText.trim().toLowerCase() ||
          m.memberNumber.toLowerCase() === rawText.trim().toLowerCase()
      );
      if (direct) {
        memberMatch = direct;
        isValid = direct.status === 'active';
      }
    }

    if (isValid && memberMatch) {
      setKioskScanFlash('success');
      setKioskFeedbackMessage(`Verified: ${memberMatch.fullName} (${memberMatch.memberNumber})`);
      handleSelectMember(memberMatch);
      setTimeout(() => setKioskScanFlash(null), 1200);
    } else {
      setKioskScanFlash('failure');
      setKioskFeedbackMessage(
        memberMatch
          ? `Member status is "${memberMatch.status.toUpperCase()}"`
          : 'Unrecognized QR code'
      );
      setTimeout(() => setKioskScanFlash(null), 1500);
    }
  };

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
    <div className="flex flex-col">
      {/* Utility Grid - Variation 6 Specification */}
      <section className="utility-grid grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-px bg-white/[0.08] border-b border-white/[0.08]">
        <div className="util-box">
          <div className="label">Venue Cap</div>
          <div className="value">
            {stats.totalCustomers}
            <span className="text-base sm:text-lg opacity-30">/80</span>
          </div>
          <div className="text-[10px] font-mono text-stone-500 mt-1">
            Max 80 customer cap
          </div>
        </div>

        <div className="util-box">
          <div className="label">Live Members</div>
          <div className="value">{stats.membersInside}</div>
          <div className="text-[10px] font-mono text-stone-500 mt-1">
            Active passholders
          </div>
        </div>

        <div className="util-box">
          <div className="label">Member Guests</div>
          <div className="value text-[#f2f2f2]">{stats.guestsInside}</div>
          <div className="text-[10px] font-mono text-stone-500 mt-1">
            Max 2 per member
          </div>
        </div>

        <div className="util-box">
          <div className="label">Proprietor</div>
          <div className="value">
            {stats.proprietorGuestsInside}
            <span className="text-base sm:text-lg opacity-30">/5</span>
          </div>
          <div className="text-[10px] font-mono text-stone-500 mt-1">
            Manager authorized
          </div>
        </div>

        <div
          onClick={() => setShowSmokingModal(true)}
          className="util-box cursor-pointer hover:bg-[#18181c] transition-colors col-span-2 md:col-span-1"
        >
          <div className="label flex items-center justify-between">
            <span className="text-amber-400/80">Smoking Cap</span>
            <span className="text-amber-400">Terrace</span>
          </div>
          <div className="value text-[#C6A052]">
            {stats.smokersOutside}
            <span className="text-base sm:text-lg opacity-30">/10</span>
          </div>
          <div className="text-[10px] font-mono text-amber-400/70 mt-1 flex items-center justify-between">
            <span>Click to manage</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </section>

      {/* Main Workspace - Variation 6 Specification (2 Panes) */}
      <section className="workspace p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] gap-8">
        {/* Left Pane: Camera Surface & Control Grid */}
        <div className="pane space-y-6">
          {/* Camera Surface */}
          <div className="camera-surface">
            {isKioskScannerActive ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {/* Visual Flash Feedback Layer */}
                {kioskScanFlash === 'success' && (
                  <div className="absolute inset-0 z-30 pointer-events-none animate-scan-success border-4 border-emerald-400 bg-emerald-500/20" />
                )}
                {kioskScanFlash === 'failure' && (
                  <div className="absolute inset-0 z-30 pointer-events-none animate-scan-failure border-4 border-rose-500 bg-rose-500/25" />
                )}

                {/* Live react-qr-reader */}
                <QrReader
                  constraints={{ facingMode: 'user', aspectRatio: 16 / 10 }}
                  scanDelay={300}
                  onResult={(result) => {
                    if (result) {
                      const text = result.getText();
                      if (text) {
                        handleLiveQrScanned(text);
                      }
                    }
                  }}
                  className="w-full h-full"
                  containerStyle={{ width: '100%', height: '100%' }}
                  videoContainerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
                  videoStyle={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                  }}
                />

                {/* Viewfinder Reticle with scannerLaser line */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-[#C6A052]/80 rounded-xl">
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-[#C6A052]" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-[#C6A052]" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-[#C6A052]" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-[#C6A052]" />

                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#E5C378] to-transparent shadow-[0_0_12px_#E5C378] animate-[scannerLaser_2.4s_ease-in-out_infinite]" />
                  </div>
                </div>

                {kioskFeedbackMessage && (
                  <div className="absolute top-3 inset-x-4 z-30 text-center">
                    <span
                      className={`px-4 py-1.5 rounded text-xs font-mono font-bold shadow-2xl inline-block ${
                        kioskScanFlash === 'success'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                          : 'bg-rose-950 text-rose-300 border border-rose-600'
                      }`}
                    >
                      {kioskFeedbackMessage}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="label tracking-[4px]">Kiosk Cam Standby</div>
                <div className="text-xs text-white/40 max-w-xs font-mono">
                  Front iPad kiosk camera is ready to read digital member passes.
                </div>
                <button
                  onClick={() => setIsKioskScannerActive(true)}
                  className="px-4 py-2 bg-[#1a1a1e] hover:bg-[#581625] border border-white/[0.08] hover:border-[#581625] text-[#C6A052] font-mono text-xs uppercase tracking-wider rounded transition-colors"
                >
                  Activate Live Kiosk Feed
                </button>
              </div>
            )}
          </div>

          {/* Control Grid - Exact Variation 6 Specification */}
          <div className="control-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setShowScannerModal(true)}
              className="button-var primary"
            >
              <QrCode className="w-5 h-5 text-[#C6A052]" />
              <span>Scan Badge</span>
            </button>

            <button
              onClick={() => setShowMemberLookup(true)}
              className="button-var"
            >
              <Search className="w-5 h-5 text-stone-300" />
              <span>Database Search</span>
            </button>

            <button
              onClick={() => setShowAddGuestModal(true)}
              disabled={nightMode.mode === 'no_new_admissions'}
              className="button-var disabled:opacity-30"
            >
              <UserPlus className="w-5 h-5 text-stone-300" />
              <span>Guest Registry</span>
            </button>

            <button
              onClick={() => setShowProprietorGuestModal(true)}
              disabled={nightMode.mode === 'no_new_admissions'}
              className="button-var disabled:opacity-30"
            >
              <Crown className="w-5 h-5 text-[#C6A052]" />
              <span>Proprietor Check</span>
            </button>

            <button
              onClick={() => setShowCheckOutModal(true)}
              className="button-var"
            >
              <LogOut className="w-5 h-5 text-stone-300" />
              <span>Checkout Mode</span>
            </button>

            <button
              onClick={() => setShowSmokingModal(true)}
              className="button-var gold"
            >
              <Flame className="w-5 h-5 text-black" />
              <span>Smoking Entry</span>
            </button>

            <button
              onClick={() => setShowIncidentModal(true)}
              className="button-var col-span-2 hover:bg-[#581625]"
            >
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>Incident Reporting</span>
            </button>

            <button
              onClick={() => setIsKioskScannerActive((prev) => !prev)}
              className="button-var"
            >
              <Camera className="w-5 h-5 text-amber-300" />
              <span>Manual Toggle</span>
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
        </div>

        {/* Right Pane: Live Attendance Register (occupancy-log) */}
        <div className="pane">
          <div className="occupancy-log bg-[#111113] border border-white/[0.08] p-5 h-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="label mb-0">Live Attendance Register</div>
              <span className="font-mono text-[10px] text-[#C6A052]">
                {activeVisits.length} INSIDE
              </span>
            </div>

            <div className="my-3">
              <input
                type="text"
                value={checkoutSearchQuery}
                onChange={(e) => setCheckoutSearchQuery(e.target.value)}
                placeholder="Filter admitted patrons..."
                className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.08] rounded text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-[#C6A052]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[560px]">
              {filteredCheckouts.length === 0 ? (
                <div className="mt-12 text-center text-[11px] font-mono text-white/30">
                  --- NO RECORDS FOUND ---
                </div>
              ) : (
                filteredCheckouts.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 bg-[#16161a] border border-white/[0.06] rounded flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span>{v.memberName}</span>
                        {v.isOutToSmoke && (
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-950 border border-amber-600/40 text-amber-300 rounded">
                            SMOKER
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 mt-0.5">
                        {v.memberNumber || v.attendeeType.replace('_', ' ')} ·{' '}
                        {new Date(v.checkInTime).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {v.guestNames && v.guestNames.length > 0 && (
                        <div className="text-[10px] text-stone-400 mt-1">
                          + Guests: {v.guestNames.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {v.isOutToSmoke ? (
                        <button
                          onClick={() => {
                            const patron = clubStore
                              .getSmokingPatrons()
                              .find((p) => p.visitId === v.id);
                            if (patron) clubStore.markSmokingReturned(patron.id);
                          }}
                          className="px-2 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-[10px] font-mono rounded"
                        >
                          Return
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            clubStore.markOutToSmoke({
                              visitId: v.id,
                              name: v.memberName,
                              type: v.attendeeType === 'proprietor_guest' ? 'proprietor_guest' : v.attendeeType === 'member_guest' ? 'guest' : 'member',
                            });
                            setShowSmokingModal(true);
                          }}
                          disabled={stats.smokersOutside >= MAX_SMOKERS_OUTSIDE}
                          className="px-2 py-1 bg-[#1f1a1d] hover:bg-[#2d2228] border border-white/[0.08] text-amber-300 text-[10px] font-mono rounded disabled:opacity-30"
                        >
                          Smoke
                        </button>
                      )}
                      <button
                        onClick={() => handleCheckOut(v.id)}
                        className="px-2.5 py-1 bg-[#581625] hover:bg-[#721C31] text-[#C6A052] text-[10px] font-mono font-bold rounded"
                      >
                        Out
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MODAL 1: CAMERA QR SCANNER & INSTANT LOOKUP (react-qr-reader with iPad Front Camera) */}
      <FrontFacingQrScanner
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onMemberScanned={(member) => {
          handleSelectMember(member);
          setShowScannerModal(false);
        }}
        currentCustomerCount={stats.totalCustomers}
      />

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

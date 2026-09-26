import React, { useState } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  UserCheck,
  UserX,
  History,
  Lock,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Member, StaffUser, ClubRuleVersion, AuditEvent } from '../../types';
import { clubStore } from '../../services/storage';
import { validate48HourWaitingPeriod } from '../../services/ruleEngine';

interface ManagementDashboardProps {
  currentStaff: StaffUser;
}

export const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ currentStaff }) => {
  const [activeTab, setActiveTab] = useState<'applications' | 'members' | 'rules' | 'audit'>(
    'applications'
  );

  const members = clubStore.getMembers();
  const stats = clubStore.getCapacityStats();
  const ruleVersions = clubStore.getRuleVersions();
  const auditLogs = clubStore.getAuditLogs();

  // Selected member for modal actions (Suspend / Revoke / Info)
  const [actionMember, setActionMember] = useState<Member | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'revoke' | 'reinstate' | 'info' | null>(
    null
  );
  const [actionReason, setActionReason] = useState('');

  // Admin 48-Hour Backdate Bypass Modal
  const [backdateTargetMember, setBackdateTargetMember] = useState<Member | null>(null);
  const [backdateJustification, setBackdateJustification] = useState(
    'Paper nomination form received 48+ hours prior'
  );

  // Reject Application Modal
  const [rejectTargetMember, setRejectTargetMember] = useState<Member | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Error / Warning Message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Rule Version Modal state
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRuleVersion, setNewRuleVersion] = useState('');
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleText, setNewRuleText] = useState('');

  // Counts
  const activeCount = members.filter((m) => m.status === 'active').length;
  const waitingCount = members.filter(
    (m) => m.status === 'waiting_48_hours' || m.status === 'pending'
  ).length;
  const readyCount = members.filter((m) => m.status === 'ready_for_review').length;
  const suspendedCount = members.filter((m) => m.status === 'suspended').length;

  const isAuthorizedManager =
    currentStaff.role === 'manager' || currentStaff.role === 'admin';

  // Handle Approval Workflow
  const handleApprove = (member: Member) => {
    if (!isAuthorizedManager) return;

    // Server-grade validation check
    const waitCheck = validate48HourWaitingPeriod(member.appliedAt);
    if (!waitCheck.allowed) {
      setErrorMessage(`Cannot approve: ${waitCheck.reason}`);
      return;
    }

    const updated: Member = {
      ...member,
      status: 'active',
      approvedAt: new Date().toISOString(),
      approvedBy: currentStaff.name,
    };

    clubStore.saveMember(
      updated,
      { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role },
      `Application approved by ${currentStaff.name}. Verified hospitality employment at ${member.employer}.`
    );
  };

  // Admin Option: Open modal to bypass 48-Hour Waiting by backdating sign-up time
  const handleOpenAdminBackdateModal = (member: Member) => {
    if (!isAuthorizedManager) return;
    setBackdateTargetMember(member);
    setBackdateJustification('Paper nomination form received 48+ hours prior');
  };

  const handleConfirmAdminBackdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backdateTargetMember || !isAuthorizedManager) return;

    clubStore.bypass48HourWaiting(
      backdateTargetMember.id,
      currentStaff,
      backdateJustification || 'Paper nomination form received 48+ hours prior'
    );

    setBackdateTargetMember(null);
  };

  const handleOpenRejectModal = (member: Member) => {
    if (!isAuthorizedManager) return;
    setRejectTargetMember(member);
    setRejectReason('');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetMember || !isAuthorizedManager) return;

    const updated: Member = {
      ...rejectTargetMember,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedReason: rejectReason || 'Did not meet membership requirements',
    };

    clubStore.saveMember(
      updated,
      { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role },
      `Application rejected. Reason: ${rejectReason || 'Did not meet requirements'}`
    );

    setRejectTargetMember(null);
  };

  const handleExecuteMemberAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMember || !actionType) return;

    let updated: Member = { ...actionMember };
    let actionLabel = '';

    if (actionType === 'suspend') {
      updated.status = 'suspended';
      updated.suspendedAt = new Date().toISOString();
      updated.suspendedReason = actionReason;
      actionLabel = 'SUSPEND_MEMBERSHIP';
    } else if (actionType === 'revoke') {
      updated.status = 'revoked';
      updated.revokedAt = new Date().toISOString();
      updated.revokedReason = actionReason;
      actionLabel = 'REVOKE_MEMBERSHIP';
    } else if (actionType === 'reinstate') {
      updated.status = 'active';
      updated.suspendedAt = undefined;
      updated.suspendedReason = undefined;
      actionLabel = 'REINSTATE_MEMBERSHIP';
    } else if (actionType === 'info') {
      updated.notes = `${updated.notes || ''}\n[Info Requested ${new Date().toLocaleDateString()}]: ${actionReason}`;
      actionLabel = 'REQUEST_ADDITIONAL_INFO';
    }

    clubStore.saveMember(
      updated,
      { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role },
      actionReason
    );

    setActionMember(null);
    setActionType(null);
    setActionReason('');
  };

  const handlePublishNewRules = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleVersion.trim() || !newRuleTitle.trim() || !newRuleText.trim()) return;

    const versionObj: ClubRuleVersion = {
      version: newRuleVersion.trim(),
      effectiveDate: new Date().toISOString(),
      title: newRuleTitle.trim(),
      summary: 'Management promulgated revision.',
      rules: newRuleText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean),
    };

    clubStore.addRuleVersion(versionObj, currentStaff);
    setShowNewRuleModal(false);
    setNewRuleVersion('');
    setNewRuleTitle('');
    setNewRuleText('');
  };

  return (
    <div className="space-y-6">
      {/* Header & RBAC Notice */}
      <div className="rounded-2xl bg-gradient-to-r from-[#200A11] via-[#141012] to-[#141012] border border-[#3E101B] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#E5C378]">
              Management & Licensing Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded bg-[#3E101B] border border-[#C6A052]/40 text-[#E5C378] text-[10px] font-mono uppercase tracking-wider">
              {currentStaff.role.toUpperCase()} LEVEL ACCESS
            </span>
          </div>
          <p className="text-xs text-stone-300 mt-1">
            48-hour statutory review engine, member disciplinary records, rule charters, and immutable audit logs.
          </p>
        </div>

        {!isAuthorizedManager && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Read-Only Mode:</strong> Approvals and disciplinary actions require Manager or Administrator role. Switch role in top header.
            </span>
          </div>
        )}
      </div>

      {/* Error / Warning Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white p-1 rounded font-mono text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Active Members
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-[#E5C378]">
            {activeCount}
          </div>
          <div className="mt-1 text-[10px] text-emerald-400">Validated trade credentials</div>
        </div>

        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            48h Waiting Queue
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-amber-400">
            {waitingCount}
          </div>
          <div className="mt-1 text-[10px] text-amber-300/80">Statutory lockout active</div>
        </div>

        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Ready for Review
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-blue-400">
            {readyCount}
          </div>
          <div className="mt-1 text-[10px] text-blue-300">48 hours elapsed</div>
        </div>

        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Suspended
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-rose-400">
            {suspendedCount}
          </div>
          <div className="mt-1 text-[10px] text-rose-300">Disciplinary hold</div>
        </div>

        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Occupancy Live
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-[#E5C378]">
            {stats.totalCustomers} <span className="text-sm text-stone-500">/ 80</span>
          </div>
          <div className="mt-1 text-[10px] text-stone-400">Customers inside</div>
        </div>

        <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Proprietor Guests
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-amber-300">
            {stats.proprietorGuestsInside} <span className="text-sm text-stone-500">/ 5</span>
          </div>
          <div className="mt-1 text-[10px] text-stone-400">Manager authorized</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2B0A13] pb-2">
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition-colors ${
            activeTab === 'applications'
              ? 'bg-[#3E101B] text-[#E5C378] border border-[#581625]'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          48-Hour Waiting & Review Queue ({waitingCount + readyCount})
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition-colors ${
            activeTab === 'members'
              ? 'bg-[#3E101B] text-[#E5C378] border border-[#581625]'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          Member Roster & Actions ({members.length})
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition-colors ${
            activeTab === 'rules'
              ? 'bg-[#3E101B] text-[#E5C378] border border-[#581625]'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          Club Rules & Versions ({ruleVersions.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition-colors ${
            activeTab === 'audit'
              ? 'bg-[#3E101B] text-[#E5C378] border border-[#581625]'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          Immutable Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: 48-HOUR WAITING & REVIEW QUEUE */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#161012] border border-[#3E101B] text-xs text-stone-300 flex items-start gap-3">
            <Clock className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <div className="font-semibold text-[#E5C378]">
                Statutory 48-Hour Rule Enforcement
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                Under the venue’s operating schedule, applicants CANNOT be approved before 48 continuous hours have elapsed. The system programmatically disables approval controls until the exact second of eligibility.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {members
              .filter(
                (m) =>
                  m.status === 'waiting_48_hours' ||
                  m.status === 'ready_for_review' ||
                  m.status === 'pending'
              )
              .map((app) => {
                const waitCheck = validate48HourWaitingPeriod(app.appliedAt);
                const isEligibleForApproval = waitCheck.allowed;

                return (
                  <div
                    key={app.id}
                    className="p-5 rounded-2xl bg-[#120F11] border border-[#2B0A13] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg font-bold text-stone-100">
                          {app.fullName}
                        </span>
                        <span className="font-mono text-xs text-[#C6A052]">
                          ({app.memberNumber})
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                            isEligibleForApproval
                              ? 'bg-blue-950/40 border-blue-500/50 text-blue-300'
                              : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                          }`}
                        >
                          {isEligibleForApproval
                            ? 'Ready for Manager Approval'
                            : 'In 48h Waiting Period'}
                        </span>
                      </div>

                      <div className="text-xs text-stone-300">
                        <strong>{app.hospitalityRole}</strong> at <strong>{app.employer}</strong>
                      </div>

                      <div className="text-[11px] text-stone-400">
                        {app.employerAddressOrWebsite}
                      </div>

                      {app.employmentEvidenceNote && (
                        <div className="p-2 rounded-lg bg-[#0B090A] border border-[#200A11] text-[11px] text-stone-300">
                          <strong className="text-[#C6A052]">Evidence:</strong> {app.employmentEvidenceNote}
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-stone-400 flex items-center gap-2 pt-1">
                        <span>Applied: {new Date(app.appliedAt).toLocaleString('en-GB')}</span>
                        <span>·</span>
                        <span>Accepted Rules: v{app.ruleAcceptance.ruleVersion}</span>
                      </div>

                      {/* Remaining countdown banner if still waiting */}
                      {!isEligibleForApproval && (
                        <div className="text-xs text-amber-400/90 font-mono flex items-center gap-1.5 pt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{waitCheck.reason}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                      {isEligibleForApproval ? (
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={!isAuthorizedManager}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600/50 text-emerald-200 text-xs font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow transition-colors"
                        >
                          Approve Membership
                        </button>
                      ) : (
                        <>
                          <button
                            disabled
                            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#181114] border border-amber-600/30 text-amber-400 text-xs font-mono disabled:opacity-50 cursor-not-allowed"
                            title="Standard 48-hour countdown is currently active"
                          >
                            48h Lock Active
                          </button>

                          {isAuthorizedManager && (
                            <button
                              onClick={() => handleOpenAdminBackdateModal(app)}
                              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#581625] hover:bg-[#741E33] border border-[#C6A052]/60 text-[#E5C378] text-xs font-mono font-bold shadow flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                              title="Admin option: record that sign-up was completed 48 hours before"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#E5C378]" />
                              <span>Admin Bypass (Done 48h Prior)</span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => {
                          setActionMember(app);
                          setActionType('info');
                        }}
                        disabled={!isAuthorizedManager}
                        className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#1C1619] hover:bg-[#282024] border border-[#3E101B] text-stone-300 text-xs font-mono disabled:opacity-40"
                      >
                        Request Info
                      </button>

                      <button
                        onClick={() => handleOpenRejectModal(app)}
                        disabled={!isAuthorizedManager}
                        className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#280C14] hover:bg-[#3E101B] border border-rose-600/40 text-rose-300 text-xs font-mono disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: ALL MEMBERS & ACTIONS */}
      {activeTab === 'members' && (
        <div className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-5 shadow-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#240D16] text-stone-400 font-mono uppercase text-[10px]">
                <th className="pb-3">Member</th>
                <th className="pb-3">Trade Role & Employer</th>
                <th className="pb-3">Rules Accepted</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Disciplinary Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D0C13]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#181316]/50 transition-colors">
                  <td className="py-3 font-medium text-stone-200">
                    <div className="text-sm font-serif font-bold text-stone-100">
                      {m.fullName}
                    </div>
                    <div className="text-[10px] font-mono text-[#C6A052]">
                      {m.memberNumber} · {m.email}
                    </div>
                  </td>
                  <td className="py-3 text-stone-300">
                    <div>{m.hospitalityRole}</div>
                    <div className="text-[11px] text-stone-500">{m.employer}</div>
                  </td>
                  <td className="py-3 font-mono text-stone-400">
                    v{m.ruleAcceptance.ruleVersion}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                        m.status === 'active'
                          ? 'border-emerald-500/50 text-emerald-300'
                          : m.status === 'waiting_48_hours'
                          ? 'border-amber-500/50 text-amber-300'
                          : m.status === 'ready_for_review'
                          ? 'border-blue-500/50 text-blue-300'
                          : 'border-rose-500/50 text-rose-300'
                      }`}
                    >
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.status === 'suspended' ? (
                        <button
                          onClick={() => {
                            setActionMember(m);
                            setActionType('reinstate');
                          }}
                          disabled={!isAuthorizedManager}
                          className="px-2.5 py-1 text-[11px] rounded bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-600/40 text-emerald-300 font-mono disabled:opacity-40"
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActionMember(m);
                            setActionType('suspend');
                          }}
                          disabled={!isAuthorizedManager}
                          className="px-2.5 py-1 text-[11px] rounded bg-[#2D161C] hover:bg-[#3D1E26] border border-[#581625] text-stone-300 font-mono disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setActionMember(m);
                          setActionType('revoke');
                        }}
                        disabled={!isAuthorizedManager}
                        className="px-2 py-1 text-[11px] rounded bg-[#280C14] hover:bg-[#3A101D] border border-rose-600/40 text-rose-300 font-mono disabled:opacity-40"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CLUB RULES VERSION ENGINE */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Club rules with statutory versioning. Members are bound by the version accepted at application.
            </p>
            <button
              onClick={() => setShowNewRuleModal(true)}
              disabled={!isAuthorizedManager}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#581625] hover:bg-[#6D1B2E] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-bold disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Rule Revision</span>
            </button>
          </div>

          <div className="space-y-4">
            {ruleVersions.map((ruleVer) => (
              <div
                key={ruleVer.version}
                className="p-5 rounded-2xl bg-[#120F11] border border-[#2B0A13] space-y-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#200A11]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#E5C378]">
                      {ruleVer.title}
                    </h3>
                    <div className="text-[11px] font-mono text-stone-400">
                      Version {ruleVer.version} · Effective from {new Date(ruleVer.effectiveDate).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-[#241217] border border-[#581625] text-[#E5C378] px-2 py-0.5 rounded">
                    Immutable
                  </span>
                </div>

                <div className="space-y-2 text-xs text-stone-300 leading-relaxed">
                  {ruleVer.rules.map((r, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-[#0C0A0C] border border-[#1A0A0F]">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: IMMUTABLE AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-5 shadow-xl overflow-x-auto">
          <div className="text-xs font-mono text-stone-400 mb-3">
            Every staff and manager decision creates an immutable regulatory audit trail.
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#240D16] text-stone-400 font-mono uppercase text-[10px]">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Actor (Staff)</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Previous State</th>
                <th className="pb-3">New State / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D0C13]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#181316]/50 transition-colors">
                  <td className="py-3 font-mono text-stone-400 text-[11px]">
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td className="py-3 font-medium text-stone-200">
                    <div>{log.actorName}</div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase">
                      {log.actorRole}
                    </div>
                  </td>
                  <td className="py-3 font-mono text-xs text-[#E5C378]">
                    {log.action}
                  </td>
                  <td className="py-3 text-stone-300">
                    {log.targetName || log.targetId}
                  </td>
                  <td className="py-3 font-mono text-stone-500">
                    {log.previousValue || '—'}
                  </td>
                  <td className="py-3 text-stone-300">
                    <div>{log.newValue}</div>
                    {log.reason && (
                      <div className="text-[10px] text-stone-500 italic mt-0.5">
                        "{log.reason}"
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: MEMBER DISCIPLINARY / REASON MODAL */}
      {actionMember && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-6">
            <h3 className="font-serif text-lg font-bold text-[#E5C378] capitalize">
              {actionType} Membership: {actionMember.fullName}
            </h3>

            <p className="text-xs text-stone-300 mt-1 mb-4">
              Enter official justification. This action is permanently recorded in the licensing audit history.
            </p>

            <form onSubmit={handleExecuteMemberAction} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1">
                  Regulatory Justification / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Detail the infraction, investigation, or reinstatement conditions..."
                  className="w-full px-3 py-2 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C6A052]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionMember(null);
                    setActionType(null);
                    setActionReason('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs text-stone-300 font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-bold"
                >
                  Confirm & Commit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PUBLISH NEW CLUB RULES */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-6">
            <h3 className="font-serif text-lg font-bold text-[#E5C378]">
              Promulgate New Club Rules Version
            </h3>
            <p className="text-xs text-stone-300 mt-1 mb-4">
              Historical versions are preserved immutably. Applicants will be required to accept this new version upon submission.
            </p>

            <form onSubmit={handlePublishNewRules} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">
                    Version Identifier (e.g. 2.1) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2.1"
                    value={newRuleVersion}
                    onChange={(e) => setNewRuleVersion(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jonny’s Soho Charter 2026 Revision"
                    value={newRuleTitle}
                    onChange={(e) => setNewRuleTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">
                  Rule Clauses (One per line) *
                </label>
                <textarea
                  required
                  rows={6}
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="1. Clause one...\n2. Clause two..."
                  className="w-full px-3 py-2 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-bold"
                >
                  Publish Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN 48-HOUR BACKDATE OVERRIDE MODAL */}
      {backdateTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl p-6">
            <div className="flex items-center gap-2.5 text-[#E5C378] mb-2">
              <Shield className="w-5 h-5 text-[#C6A052]" />
              <h3 className="font-serif text-lg font-bold">
                Admin 48-Hour Backdate Override
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-[#26150D] border border-amber-600/40 text-xs text-amber-200/90 mb-4 space-y-1">
              <div className="font-bold text-amber-300">
                Applicant: {backdateTargetMember.fullName} ({backdateTargetMember.memberNumber})
              </div>
              <p className="text-[11px] leading-relaxed">
                Westminster Licensing statutory condition requires 48 continuous hours between nomination and privileges. Use this option to certify that the nomination or paper application was physically completed 48+ hours ago.
              </p>
              <div className="text-[10px] text-amber-400 font-mono pt-1">
                ● Backdates applied timestamp to 49 hours ago<br />
                ● Immediately activates membership status<br />
                ● Permanently logs audit trail under {currentStaff.name} ({currentStaff.badgeNumber})
              </div>
            </div>

            <form onSubmit={handleConfirmAdminBackdate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                  Regulatory Justification / Reference *
                </label>
                <input
                  type="text"
                  required
                  value={backdateJustification}
                  onChange={(e) => setBackdateJustification(e.target.value)}
                  placeholder="e.g. Paper nomination form received 48+ hours prior at reception"
                  className="w-full px-3.5 py-2.5 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C6A052]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBackdateTargetMember(null)}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs text-stone-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#581625] hover:bg-[#6F1C30] border border-[#C6A052]/50 text-[#E5C378] text-xs font-mono font-bold shadow-lg flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E5C378]" />
                  <span>Confirm & Activate Immediately</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT APPLICANT MODAL */}
      {rejectTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#121214] border border-rose-900/60 shadow-2xl p-6">
            <h3 className="font-serif text-lg font-bold text-rose-300">
              Reject Application: {rejectTargetMember.fullName}
            </h3>
            <p className="text-xs text-stone-300 mt-1 mb-4">
              Specify reason for refusal (e.g. non-hospitality profession, incomplete verification, regulatory grounds).
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State statutory or governance reason..."
                  className="w-full px-3 py-2 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectTargetMember(null)}
                  className="px-4 py-2 rounded-lg bg-[#221B1E] text-xs text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-600/50 text-rose-200 text-xs font-mono font-bold"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  Clock,
  Building2,
  Briefcase,
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Member, RuleAcceptance } from '../../types';
import { clubStore } from '../../services/storage';

export const MembershipApplicationFlow: React.FC = () => {
  const currentRules = clubStore.getCurrentRuleVersion();
  const currentStaff = clubStore.getCurrentStaff();
  const isAdmin = currentStaff.role === 'admin' || currentStaff.role === 'manager';

  // Form State
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employer, setEmployer] = useState('');
  const [hospitalityRole, setHospitalityRole] = useState('');
  const [employerWebsiteOrAddress, setEmployerWebsiteOrAddress] = useState('');
  const [employmentEvidenceNote, setEmploymentEvidenceNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [agreeToRules, setAgreeToRules] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Admin 48-Hour Backdate Option
  const [adminBackdate48Hours, setAdminBackdate48Hours] = useState(false);
  const [adminJustification, setAdminJustification] = useState('Paper nomination form received 48+ hours prior');

  // Submission Status
  const [submittedMember, setSubmittedMember] = useState<Member | null>(null);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(48 * 3600);

  // Live 48-hour countdown effect
  useEffect(() => {
    if (!submittedMember) return;

    const calculateRemaining = () => {
      const appliedTime = new Date(submittedMember.appliedAt).getTime();
      const eligibleTime = appliedTime + 48 * 3600 * 1000;
      const diffMs = eligibleTime - Date.now();
      setTimeRemainingSeconds(Math.max(0, Math.floor(diffMs / 1000)));
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);
    return () => clearInterval(timer);
  }, [submittedMember]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeToRules || !privacyConsent) return;

    const nowIso = new Date().toISOString();
    const memberNumber = `JNY-${Math.floor(1000 + Math.random() * 9000)}`;

    const ruleAcceptance: RuleAcceptance = {
      ruleVersion: currentRules.version,
      acceptedAt: nowIso,
      applicantEmail: email,
    };

    // If Admin chooses to backdate to say it was completed 48 hours before
    const isBackdated = isAdmin && adminBackdate48Hours;
    const appliedAtIso = isBackdated
      ? new Date(Date.now() - 49 * 3600 * 1000).toISOString()
      : nowIso;
    const eligibleAtIso = isBackdated
      ? new Date(Date.now() - 1 * 3600 * 1000).toISOString()
      : new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const newMember: Member = {
      id: `mem-${Date.now()}`,
      memberNumber,
      fullName: fullName.trim(),
      dateOfBirth,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      employer: employer.trim(),
      hospitalityRole: hospitalityRole.trim(),
      employerAddressOrWebsite: employerWebsiteOrAddress.trim(),
      employmentEvidenceNote: employmentEvidenceNote.trim() || undefined,
      photoUrl: photoUrl.trim() || '/src/assets/images/sample_member_photo_1790393794509.jpg',
      status: isBackdated ? 'active' : 'waiting_48_hours',
      appliedAt: appliedAtIso,
      eligibleAt: eligibleAtIso,
      approvedAt: isBackdated ? nowIso : undefined,
      approvedBy: isBackdated ? currentStaff.name : undefined,
      ruleAcceptance,
      notes: isBackdated
        ? `[ADMIN OVERRIDE by ${currentStaff.name}]: Sign-up was completed 48 hours before (${adminJustification}). Active on submission.`
        : 'Submitted via digital application portal. Verified hospitality profession requirement.',
    };

    clubStore.saveMember(
      newMember,
      { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role },
      isBackdated
        ? `Admin backdate override: verified sign-up was done 48 hours before (${adminJustification})`
        : 'New applicant submission'
    );
    setSubmittedMember(newMember);
  };

  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = timeRemainingSeconds % 60;

  // Screen after submission: "APPLICATION RECEIVED" or "MEMBERSHIP ACTIVATED (ADMIN OVERRIDE)"
  if (submittedMember) {
    const isInstantActive = submittedMember.status === 'active';

    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center">
        <div className="rounded-3xl bg-[#141012] border-2 border-[#581625] shadow-2xl p-6 sm:p-10 relative overflow-hidden">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg border ${
            isInstantActive
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
              : 'bg-[#2A0C14] border-[#C6A052] text-[#E5C378]'
          }`}>
            {isInstantActive ? <CheckCircle2 className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
          </div>

          <div className="text-xs font-mono tracking-widest text-[#9B7836] uppercase">
            JONNY’S SOHO · ADMISSIONS
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#E5C378] mt-2 mb-3">
            {isInstantActive ? 'MEMBERSHIP ACTIVATED' : 'APPLICATION RECEIVED'}
          </h1>

          {isInstantActive ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/50 my-6 text-stone-200 text-sm leading-relaxed text-left">
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase mb-1">
                <Shield className="w-4 h-4" />
                <span>Admin Override Applied · 48H Requirement Satisfied</span>
              </div>
              <p className="text-xs text-stone-300">
                Application timestamp was officially backdated to 48 hours prior ({submittedMember.notes}). The applicant has been issued active membership and is immediately eligible for door admission and late-night guest sponsorship.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#1E1418] border border-[#3E101B] my-6 text-stone-300 text-sm leading-relaxed text-left">
              <p className="font-serif text-base text-[#E5C378] mb-2 font-medium">
                “Membership applications are subject to review and a minimum 48-hour waiting period before membership privileges can begin.”
              </p>
              <p className="text-xs text-stone-400">
                Pursuant to Westminster City Council club licensing regulations for 23 Frith Street, membership privileges, late-night door access, and member guest arrangements cannot commence until 48 full hours have elapsed.
              </p>
            </div>
          )}

          {/* Live Countdown Timer (only if still waiting) */}
          {!isInstantActive && (
            <div className="p-6 rounded-2xl bg-[#0B090A] border border-[#2B0A13] my-6">
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-2">
                Mandatory Waiting Period Countdown
              </div>
              <div className="flex items-center justify-center gap-3 font-mono text-3xl sm:text-4xl font-bold text-[#E5C378]">
                <div className="p-3 rounded-xl bg-[#181114] border border-[#3E101B] min-w-[70px]">
                  <div>{String(hours).padStart(2, '0')}</div>
                  <div className="text-[10px] text-stone-500 font-sans uppercase">Hours</div>
                </div>
                <span className="text-stone-600">:</span>
                <div className="p-3 rounded-xl bg-[#181114] border border-[#3E101B] min-w-[70px]">
                  <div>{String(minutes).padStart(2, '0')}</div>
                  <div className="text-[10px] text-stone-500 font-sans uppercase">Minutes</div>
                </div>
                <span className="text-stone-600">:</span>
                <div className="p-3 rounded-xl bg-[#181114] border border-[#3E101B] min-w-[70px]">
                  <div>{String(seconds).padStart(2, '0')}</div>
                  <div className="text-[10px] text-stone-500 font-sans uppercase">Seconds</div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#1D1115] border border-amber-500/20 text-xs text-amber-200/90 text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>Important Notice:</strong> Expiry of the 48-hour waiting period does not automatically guarantee approval. All candidates are reviewed by management for verified active employment in the hospitality trade.
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1 text-xs text-stone-400">
            <div>Candidate: <strong className="text-stone-200">{submittedMember.fullName}</strong></div>
            <div>Application Reference: <span className="font-mono text-[#E5C378]">{submittedMember.memberNumber}</span></div>
            <div>Trade Role: <span className="text-stone-300">{submittedMember.hospitalityRole} at {submittedMember.employer}</span></div>
            <div>Status: <span className={`font-mono font-bold uppercase ${isInstantActive ? 'text-emerald-400' : 'text-amber-400'}`}>{submittedMember.status.replace('_', ' ')}</span></div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setSubmittedMember(null)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#28181F] hover:bg-[#38222C] border border-[#C6A052]/40 text-[#E5C378] text-xs font-semibold"
            >
              Submit Another Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 px-4 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#200A11] via-[#141012] to-[#141012] border border-[#3E101B] p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#9B7836] uppercase">
          PETTITT · 23 FRITH STREET SOHO
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#E5C378] mt-1 mb-2">
          Hospitality Industry Membership
        </h1>
        <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
          Jonny’s Members is a private Soho sanctuary exclusively reserved for individuals actively employed in the hospitality, food & beverage, and culinary professions.
        </p>

        <div className="mt-4 p-3 rounded-xl bg-[#160E11] border border-[#3E101B] text-xs text-stone-400">
          <strong className="text-[#E5C378]">Statutory 48-Hour Condition:</strong> All nominations and applications undergo a mandatory 48-hour waiting period prior to management review and door card activation.
        </div>
      </div>

      {/* Application Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="font-serif text-xl font-bold text-[#E5C378] pb-3 border-b border-[#280C14]">
          Applicant Personal & Professional Profile
        </h2>

        {/* 1. Personal Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Camilla Moreau"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Date of Birth * (Must be 18+)
            </label>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 focus:outline-none focus:border-[#C6A052]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. c.moreau@quovadissoho.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Mobile Contact Number *
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. +44 7700 900142"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>
        </div>

        {/* 2. Hospitality Employment Qualifications */}
        <div className="pt-4 border-t border-[#200A11] space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-[#C6A052] flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Hospitality Industry Employment Qualification
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                Current Employer / Business *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Quo Vadis, Bar Termini, Dean St Townhouse"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
                Hospitality Role / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Head Sommelier, Bar Manager, Sous Chef"
                value={hospitalityRole}
                onChange={(e) => setHospitalityRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Employer Address or Website *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 26-29 Dean Street, London W1D 3LL or https://quovadissoho.co.uk"
              value={employerWebsiteOrAddress}
              onChange={(e) => setEmployerWebsiteOrAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Employment Verification Notes / References (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide employer reference, WSET qualification, or licence number..."
              value={employmentEvidenceNote}
              onChange={(e) => setEmploymentEvidenceNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1">
              Profile Photo URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://... (or leave blank to use hospitality badge photo)"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0A0809] border border-[#3E101B] rounded-lg text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C6A052]"
            />
          </div>
        </div>

        {/* 3. Club Rules Agreement & Privacy */}
        <div className="pt-4 border-t border-[#200A11] space-y-4">
          <div className="p-4 rounded-xl bg-[#0F0B0D] border border-[#2B0A13]">
            <h3 className="font-serif text-sm font-bold text-[#E5C378] mb-2 flex items-center justify-between">
              <span>{currentRules.title} (Version {currentRules.version})</span>
              <span className="text-[10px] font-mono text-stone-500">Effective 2026</span>
            </h3>
            <div className="space-y-1.5 text-xs text-stone-400 max-h-40 overflow-y-auto pr-2">
              {currentRules.rules.map((rule, idx) => (
                <p key={idx} className="leading-relaxed">
                  {rule}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={agreeToRules}
                onChange={(e) => setAgreeToRules(e.target.checked)}
                className="mt-0.5 rounded bg-[#0B090A] border-[#3E101B] text-[#C6A052] focus:ring-0"
              />
              <span className="text-xs text-stone-300 leading-normal">
                I hereby accept and agree to abide by Jonny’s Soho Club Rules (v{currentRules.version}). I acknowledge that membership approval requires a minimum 48-hour statutory waiting period and is non-transferable.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 rounded bg-[#0B090A] border-[#3E101B] text-[#C6A052] focus:ring-0"
              />
              <span className="text-xs text-stone-300 leading-normal">
                I consent to the lawful processing of my contact and attendance information for statutory door licensing and venue safety register purposes (retained for minimum 31 days).
              </span>
            </label>
          </div>
        </div>

        {/* Admin 48-Hour Backdate Option */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-[#26150D] border-2 border-amber-500/60 shadow-lg space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="adminBackdateCheck"
                checked={adminBackdate48Hours}
                onChange={(e) => setAdminBackdate48Hours(e.target.checked)}
                className="mt-1 rounded bg-[#100806] border-amber-600/70 text-[#C6A052] focus:ring-0"
              />
              <div className="flex-1">
                <label
                  htmlFor="adminBackdateCheck"
                  className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-[#E5C378]" />
                  <span>Admin Option: Sign-Up was completed 48 hours before (Bypass 48h Wait)</span>
                </label>
                <p className="text-[11px] text-stone-300 mt-1 leading-relaxed">
                  Record that this applicant’s paper nomination or register entry was physically completed 48+ hours prior. This backdates the submission timestamp to 48 hours ago, satisfying statutory compliance and granting immediate active door privileges upon submission.
                </p>
              </div>
            </div>

            {adminBackdate48Hours && (
              <div className="pt-2 border-t border-amber-500/20 pl-7">
                <label className="block text-[10px] font-mono uppercase text-amber-300/80 mb-1">
                  Admin Verification Justification
                </label>
                <input
                  type="text"
                  value={adminJustification}
                  onChange={(e) => setAdminJustification(e.target.value)}
                  placeholder="e.g. Paper nomination form received 48 hours prior at reception"
                  className="w-full px-3 py-1.5 bg-[#120B08] border border-amber-500/40 rounded text-xs text-stone-200 focus:outline-none focus:border-[#C6A052]"
                />
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-[#200A11] flex justify-end">
          <button
            type="submit"
            disabled={!agreeToRules || !privacyConsent}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#581625] to-[#3E101B] hover:from-[#6D1B2E] hover:to-[#501523] border border-[#C6A052]/50 text-[#E5C378] font-mono text-sm font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Submit Membership Application
          </button>
        </div>
      </form>
    </div>
  );
};

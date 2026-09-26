import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Download,
  AlertTriangle,
  User,
  ChevronDown,
} from 'lucide-react';
import { Member } from '../../types';
import { clubStore, subscribeToStore } from '../../services/storage';
import { generateSignedMemberToken } from '../../services/security';

export const DigitalMemberCard: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(clubStore.getMembers());
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    members.find((m) => m.status === 'active')?.id || members[0]?.id || ''
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [activeToken, setActiveToken] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setMembers(clubStore.getMembers());
    });
    return unsub;
  }, []);

  const activeMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // Rotate QR code token every 60 seconds
  useEffect(() => {
    if (!activeMember) return;

    const updateQr = async () => {
      const now = Date.now();
      const tokenObj = generateSignedMemberToken(activeMember.id, now);
      setActiveToken(tokenObj.token);
      setSecondsRemaining(tokenObj.secondsRemaining);

      try {
        const url = await QRCode.toDataURL(tokenObj.token, {
          width: 280,
          margin: 1,
          color: {
            dark: '#161012',
            light: '#F5E6CA',
          },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    updateQr();
    const interval = setInterval(updateQr, 1000);

    return () => clearInterval(interval);
  }, [activeMember?.id]);

  if (!activeMember) {
    return (
      <div className="p-8 text-center text-stone-400">
        No membership records available.
      </div>
    );
  }

  const memberSinceYear = new Date(activeMember.appliedAt).getFullYear();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Selector & Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#141012] border border-[#3E101B]">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#E5C378]">
            Digital Membership Passes
          </h2>
          <p className="text-xs text-stone-400">
            Passes feature rotating signed QR tokens to prevent screenshot forwarding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">Select Member:</span>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="px-3 py-1.5 bg-[#0E0C0E] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C6A052]"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#121214]">
                {m.fullName} ({m.memberNumber}) — {m.status.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Luxury Digital Membership Card Container */}
      <div className="flex justify-center p-2 sm:p-6">
        <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C1216] via-[#120B0E] to-[#0A0708] border-2 border-[#C6A052]/60 shadow-2xl p-6 sm:p-7 relative overflow-hidden text-center">
          {/* Subtle Art Deco Gold Background Ornaments */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#C6A052] to-transparent opacity-80" />
          <div className="absolute -top-12 -left-12 w-28 h-28 rounded-full border border-[#C6A052]/20 pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full border border-[#581625]/40 pointer-events-none" />

          {/* Card Header Brand Lockup */}
          <div className="relative z-10 pb-4 border-b border-[#3E101B]">
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#9B7836]">
              PETTITT · 23 FRITH STREET SOHO
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-widest text-[#E5C378] mt-1">
              JONNY’S
            </h1>
            <div className="text-xs font-mono tracking-[0.4em] uppercase text-[#C6A052]">
              MEMBER PASS
            </div>
          </div>

          {/* Member Photo & Crest */}
          <div className="my-5 relative flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#C6A052] shadow-xl bg-[#1F171A]">
                {activeMember.photoUrl ? (
                  <img
                    src={activeMember.photoUrl}
                    alt={activeMember.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#E5C378]">
                    <User className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-[#581625] border border-[#C6A052] flex items-center justify-center text-[#E5C378] text-[10px] font-serif font-bold">
                J
              </div>
            </div>
          </div>

          {/* Member Name & Credentials */}
          <div className="space-y-1">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-100">
              {activeMember.fullName}
            </h2>
            <div className="text-xs font-medium text-[#C6A052]">
              {activeMember.hospitalityRole}
            </div>
            <div className="text-[11px] text-stone-400">
              {activeMember.employer}
            </div>
          </div>

          {/* Member Number & Metadata Strip */}
          <div className="my-4 py-2 px-3 rounded-xl bg-[#140E10] border border-[#2B0A13] flex items-center justify-between text-left">
            <div>
              <div className="text-[9px] font-mono uppercase text-stone-500">MEMBER NO.</div>
              <div className="text-xs font-mono font-bold text-[#E5C378]">
                {activeMember.memberNumber}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-stone-500">MEMBER SINCE</div>
              <div className="text-xs font-mono text-stone-300">
                {memberSinceYear}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-stone-500">STATUS</div>
              <div
                className={`text-[10px] font-mono font-bold uppercase ${
                  activeMember.status === 'active'
                    ? 'text-emerald-400'
                    : activeMember.status === 'waiting_48_hours'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {activeMember.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* High Security Rotating QR Code Frame */}
          <div className="p-3 bg-[#F5E6CA] rounded-2xl shadow-inner inline-block my-2 border border-[#C6A052]">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Dynamic Member QR"
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-stone-800 text-xs">
                Generating Token...
              </div>
            )}
          </div>

          {/* Dynamic Screenshot Protection Gauge */}
          <div className="mt-3 px-4">
            <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 mb-1">
              <span className="flex items-center gap-1 text-[#C6A052]">
                <ShieldCheck className="w-3 h-3" />
                Rotating Security Token
              </span>
              <span>Expires in {secondsRemaining}s</span>
            </div>
            <div className="w-full bg-[#2B0A13] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#C6A052] h-full transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsRemaining / 60) * 100}%` }}
              />
            </div>
          </div>

          {/* Disclaimer Footer */}
          <div className="mt-4 pt-3 border-t border-[#2B0A13] text-[10px] text-stone-400 leading-tight">
            Non-transferable. Present at 23 Frith Street door kiosk. Admission subject to club operating schedule.
          </div>
        </div>
      </div>
    </div>
  );
};

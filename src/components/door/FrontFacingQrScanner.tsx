import React, { useState, useEffect, useRef } from 'react';
import { QrReader } from 'react-qr-reader';
import {
  Camera,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Member } from '../../types';
import { clubStore } from '../../services/storage';
import { parseMemberFromQRToken } from '../../services/security';

interface FrontFacingQrScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberScanned: (member: Member) => void;
  currentCustomerCount?: number;
}

export const FrontFacingQrScanner: React.FC<FrontFacingQrScannerProps> = ({
  isOpen,
  onClose,
  onMemberScanned,
  currentCustomerCount = 0,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'prompt' | 'denied'>('checking');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // Default to iPad front-facing camera
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanFlash, setScanFlash] = useState<'success' | 'failure' | null>(null);
  const [lastResult, setLastResult] = useState<{
    member: Member | null;
    rawText: string;
    isValid: boolean;
    reason?: string;
  } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Play auditory tone
  const playScanFeedbackTone = (success: boolean) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.26);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(146.83, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.23);
      }
    } catch {
      // Audio playback failed or blocked by policy
    }
  };

  // Check camera permissions respecting metadata.json ("camera" in requestFramePermissions)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function checkCameraPermission() {
      setPermissionStatus('checking');
      setPermissionError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setPermissionStatus('denied');
          setPermissionError('Camera API is not supported on this browser or platform.');
        }
        return;
      }

      try {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
            if (isMounted) {
              setPermissionStatus(status.state);
              status.onchange = () => {
                if (isMounted) {
                  setPermissionStatus(status.state);
                }
              };
            }
          } catch {
            // Some browsers don't support querying 'camera'
            if (isMounted) setPermissionStatus('prompt');
          }
        } else {
          if (isMounted) setPermissionStatus('prompt');
        }
      } catch (err: unknown) {
        if (isMounted) {
          setPermissionStatus('prompt');
          if (err instanceof Error) {
            setPermissionError(err.message);
          }
        }
      }
    }

    checkCameraPermission();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle scanned raw QR data from react-qr-reader
  const handleQrDetected = (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const members = clubStore.getMembers();
    const tokenResult = parseMemberFromQRToken(text, members);

    let memberMatch: Member | null = null;
    let isValid = false;
    let reason = '';

    if (tokenResult.valid && tokenResult.member) {
      const found = tokenResult.member as Member;
      memberMatch = found;
      if (found.status === 'active') {
        isValid = true;
      } else if (found.status === 'waiting_48_hours') {
        isValid = false;
        reason = 'Mandatory 48-hour statutory waiting period is still active.';
      } else if (found.status === 'suspended') {
        isValid = false;
        reason = 'Membership privileges currently suspended by management.';
      } else {
        isValid = false;
        reason = `Membership status is "${found.status.toUpperCase()}".`;
      }
    } else {
      // Try direct match against ID or member number
      const direct = members.find(
        (m) =>
          m.id.toLowerCase() === text.trim().toLowerCase() ||
          m.memberNumber.toLowerCase() === text.trim().toLowerCase()
      );
      if (direct) {
        memberMatch = direct;
        if (direct.status === 'active') {
          isValid = true;
        } else {
          isValid = false;
          reason = `Member status is "${direct.status.toUpperCase()}" (not active).`;
        }
      } else {
        isValid = false;
        reason = tokenResult.error || 'Unrecognized QR token or member not found.';
      }
    }

    // Trigger visual flash
    setScanFlash(isValid ? 'success' : 'failure');
    playScanFeedbackTone(isValid);

    if (navigator.vibrate) {
      navigator.vibrate(isValid ? [60, 40, 60] : [200, 100, 200]);
    }

    setLastResult({
      member: memberMatch,
      rawText: text,
      isValid,
      reason,
    });

    if (isValid && memberMatch) {
      setTimeout(() => {
        onMemberScanned(memberMatch);
        setIsProcessing(false);
        setScanFlash(null);
      }, 750);
    } else {
      setTimeout(() => {
        setIsProcessing(false);
        setScanFlash(null);
      }, 1600);
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualError(null);

    const members = clubStore.getMembers();
    const query = manualCode.trim().toLowerCase();
    const found = members.find(
      (m) =>
        m.memberNumber.toLowerCase() === query ||
        m.fullName.toLowerCase().includes(query) ||
        m.id.toLowerCase() === query
    );

    if (found) {
      handleQrDetected(found.memberNumber);
      setManualCode('');
    } else {
      setManualError(`No member found matching "${manualCode}".`);
      setScanFlash('failure');
      playScanFeedbackTone(false);
      setTimeout(() => setScanFlash(null), 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-[#110D0F] border border-[#581625] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-5 py-4 bg-[#181316] border-b border-[#2B0A13] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2D161C] border border-[#581625] flex items-center justify-center text-[#E5C378]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-base sm:text-lg font-bold text-[#E5C378] tracking-wide">
                  iPad Front-Camera QR Scanner
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                  LIVE
                </span>
              </div>
              <div className="text-[11px] text-stone-400 font-mono">
                Facing: {facingMode === 'user' ? 'Front-Facing (Kiosk Reception)' : 'Rear-Facing'}
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              title="Switch Camera (Front / Rear)"
              className="p-2.5 rounded-xl bg-[#221B1E] hover:bg-[#2F2429] border border-[#3E101B] text-amber-200 text-xs font-mono flex items-center gap-1 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Flip</span>
            </button>
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
              className="p-2.5 rounded-xl bg-[#221B1E] hover:bg-[#2F2429] border border-[#3E101B] text-stone-300 active:scale-95 transition-all"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[#221B1E] hover:bg-[#34111C] border border-[#3E101B] hover:border-rose-600/50 text-stone-300 hover:text-white active:scale-95 transition-all ml-1"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Container with Scanning Frame & scannerLaser */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[360px]">
          {/* Permission Denied Banner */}
          {permissionStatus === 'denied' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#100D0F] p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-600 flex items-center justify-center text-rose-400 mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="font-serif text-lg font-bold text-rose-300">Camera Permission Required</div>
              <div className="text-xs text-stone-400 mt-1 mb-4 max-w-sm">
                {permissionError || 'The browser or iframe blocked camera access. Please allow camera permissions to scan member passes.'}
              </div>
              <div className="text-[11px] font-mono text-amber-300/80 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-600/30">
                Configured in metadata.json: requestFramePermissions: [&quot;camera&quot;]
              </div>
            </div>
          )}

          {/* Instant Visual Flash Feedback (Green/Red) */}
          {scanFlash === 'success' && (
            <div className="absolute inset-0 pointer-events-none z-30 animate-scan-success border-4 border-emerald-400 bg-emerald-500/15" />
          )}
          {scanFlash === 'failure' && (
            <div className="absolute inset-0 pointer-events-none z-30 animate-scan-failure border-4 border-rose-500 bg-rose-500/20" />
          )}

          {/* react-qr-reader component with iPad front camera constraints */}
          <div className="w-full h-full min-h-[300px] sm:min-h-[360px] flex items-center justify-center">
            <QrReader
              constraints={{
                facingMode,
                aspectRatio: 1,
              }}
              scanDelay={300}
              onResult={(result, error) => {
                if (result) {
                  const text = result.getText();
                  if (text && !isProcessing) {
                    handleQrDetected(text);
                  }
                }
                if (error) {
                  // Standard continuous scanning tick with no code present
                }
              }}
              className="w-full h-full"
              containerStyle={{ width: '100%', height: '100%' }}
              videoContainerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
              videoStyle={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
          </div>

          {/* Art Deco Gold Scanning Reticle Frame */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dimmed Vignette Mask */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Target Reticle (Optimized for iPad reception ~280px) */}
            <div
              className={`relative w-64 h-64 sm:w-72 sm:h-72 border-2 transition-all duration-300 rounded-2xl ${
                scanFlash === 'success' || (lastResult?.isValid)
                  ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_40px_rgba(52,211,153,0.7)]'
                  : scanFlash === 'failure' || (lastResult && !lastResult.isValid)
                  ? 'border-rose-500 bg-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.7)]'
                  : 'border-[#C6A052]/90 shadow-[0_0_24px_rgba(198,160,82,0.3)]'
              }`}
            >
              {/* Art Deco Gold Corner Accents */}
              <div
                className={`absolute -top-1.5 -left-1.5 w-7 h-7 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-200 ${
                  scanFlash === 'success'
                    ? 'border-emerald-400'
                    : scanFlash === 'failure'
                    ? 'border-rose-500'
                    : 'border-[#E5C378]'
                }`}
              />
              <div
                className={`absolute -top-1.5 -right-1.5 w-7 h-7 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-200 ${
                  scanFlash === 'success'
                    ? 'border-emerald-400'
                    : scanFlash === 'failure'
                    ? 'border-rose-500'
                    : 'border-[#E5C378]'
                }`}
              />
              <div
                className={`absolute -bottom-1.5 -left-1.5 w-7 h-7 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-200 ${
                  scanFlash === 'success'
                    ? 'border-emerald-400'
                    : scanFlash === 'failure'
                    ? 'border-rose-500'
                    : 'border-[#E5C378]'
                }`}
              />
              <div
                className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 border-b-4 border-r-4 rounded-br-lg transition-colors duration-200 ${
                  scanFlash === 'success'
                    ? 'border-emerald-400'
                    : scanFlash === 'failure'
                    ? 'border-rose-500'
                    : 'border-[#E5C378]'
                }`}
              />

              {/* Animated Laser Scanning Line (Powered by scannerLaser keyframe in index.css) */}
              <div
                className={`absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#E5C378] to-transparent shadow-[0_0_12px_#E5C378] animate-[scannerLaser_2.4s_ease-in-out_infinite] ${
                  scanFlash === 'success'
                    ? 'via-emerald-300 shadow-[0_0_14px_#34D399]'
                    : scanFlash === 'failure'
                    ? 'via-rose-400 shadow-[0_0_14px_#F43F5E]'
                    : ''
                }`}
              />

              {/* Reticle Center Guide */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-[#C6A052]/60 rounded-full flex items-center justify-center opacity-75">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    scanFlash === 'success'
                      ? 'bg-emerald-400'
                      : scanFlash === 'failure'
                      ? 'bg-rose-500'
                      : 'bg-[#E5C378]'
                  }`}
                />
              </div>
            </div>

            {/* Subtitle guidance */}
            <div className="absolute bottom-4 inset-x-0 text-center">
              <span className="px-4 py-1.5 rounded-full bg-black/85 backdrop-blur-md text-[#E5C378] text-xs font-mono border border-[#C6A052]/40 shadow-xl tracking-wide">
                Present Digital Card QR to Front iPad Camera
              </span>
            </div>
          </div>

          {/* Instant Match Overlay Banner */}
          {lastResult && (
            <div className="absolute inset-x-4 top-4 z-30 animate-fadeIn">
              {lastResult.isValid && lastResult.member ? (
                <div className="p-4 rounded-xl bg-[#141214]/95 border-2 border-emerald-500 shadow-2xl backdrop-blur-md flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/90 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                        ACTIVE MEMBER IDENTIFIED
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-600/40">
                        {lastResult.member.memberNumber}
                      </span>
                    </div>
                    <div className="font-serif text-lg font-bold text-white truncate">
                      {lastResult.member.fullName}
                    </div>
                    <div className="text-[11px] font-mono text-[#C6A052]">
                      {lastResult.member.hospitalityRole} at {lastResult.member.employer}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#1A0A0F]/95 border-2 border-rose-600 shadow-2xl backdrop-blur-md flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-950/90 border border-rose-500 flex items-center justify-center text-rose-400 shrink-0">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">
                      SCAN NOT AUTHORISED
                    </div>
                    <div className="text-xs text-rose-200 mt-0.5">
                      {lastResult.reason || 'Invalid QR code or member not eligible for admission.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Panel: Manual Entry & Simulated Quick Badges for Testing */}
        <div className="p-4 bg-[#140F12] border-t border-[#2B0A13] space-y-3 overflow-y-auto max-h-56">
          <form onSubmit={handleManualLookup} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type Member No. (e.g. JNY-0842) / Host name..."
              className="flex-1 px-3.5 py-2.5 bg-[#0B080A] border border-[#3E101B] rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#581625] hover:bg-[#6D1B2E] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-bold shrink-0 active:scale-95 transition-all"
            >
              Lookup
            </button>
          </form>

          {manualError && (
            <div className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{manualError}</span>
            </div>
          )}

          {/* Quick Touch Badges for Immediate iPad Testing */}
          <div className="pt-2 border-t border-[#25171B]">
            <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center justify-between mb-2">
              <span className="flex items-center gap-1 text-[#E5C378]">
                <Sparkles className="w-3 h-3" /> Quick Test Badges (Simulate QR Scan)
              </span>
              <span className="text-[10px] text-stone-500">Occupancy: {currentCustomerCount}/80</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQrDetected('JNY-0842')}
                className="p-2.5 rounded-xl bg-[#181316] hover:bg-[#25171E] border border-emerald-500/40 text-left active:scale-95 transition-all"
              >
                <div className="text-xs font-serif font-bold text-emerald-300">Marcus Sterling</div>
                <div className="text-[10px] font-mono text-stone-400">JNY-0842 · ACTIVE (Valid)</div>
              </button>
              <button
                type="button"
                onClick={() => handleQrDetected('JNY-1029')}
                className="p-2.5 rounded-xl bg-[#181316] hover:bg-[#25171E] border border-amber-500/40 text-left active:scale-95 transition-all"
              >
                <div className="text-xs font-serif font-bold text-amber-300">Liam O&apos;Connor</div>
                <div className="text-[10px] font-mono text-stone-400">JNY-1029 · 48H WAITING</div>
              </button>
              <button
                type="button"
                onClick={() => handleQrDetected('JNY-9999')}
                className="p-2.5 rounded-xl bg-[#181316] hover:bg-[#25171E] border border-rose-500/40 text-left active:scale-95 transition-all"
              >
                <div className="text-xs font-serif font-bold text-rose-300">Invalid Token</div>
                <div className="text-[10px] font-mono text-stone-400">Trigger Rejection Flash</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

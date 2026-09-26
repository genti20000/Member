import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  FlipHorizontal,
  Zap,
  ZapOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Member } from '../../types';
import { clubStore } from '../../services/storage';
import { verifyMemberToken } from '../../services/security';

interface CameraQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberScanned: (member: Member) => void;
  currentCustomerCount: number;
}

// Synthesizes a subtle, pleasant luxury chime upon successful scan
function playScanChime(success = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.17);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // Audio autoplay restrictions or headless environment
  }
}

export const CameraQRScannerModal: React.FC<CameraQRScannerModalProps> = ({
  isOpen,
  onClose,
  onMemberScanned,
  currentCustomerCount,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'denied' | 'unsupported'>('requesting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    member: Member | null;
    rawText: string;
    isValid: boolean;
    reason?: string;
  } | null>(null);
  const [scanFlashState, setScanFlashState] = useState<'success' | 'failure' | null>(null);
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Process a decoded QR string (from video stream or test badge)
  const handleDecodedString = useCallback(
    (rawContent: string) => {
      if (isProcessingMatch) return;
      setIsProcessingMatch(true);

      const trimmed = rawContent.trim();
      const verified = verifyMemberToken(trimmed);

      if (!verified.isValid || !verified.memberId) {
        playScanChime(false);
        setScanFlashState('failure');
        setLastScannedResult({
          member: null,
          rawText: trimmed,
          isValid: false,
          reason: verified.reason || 'Invalid QR code token format',
        });
        setTimeout(() => setScanFlashState(null), 700);
        setTimeout(() => setIsProcessingMatch(false), 1400);
        return;
      }

      // Lookup member by ID or memberNumber
      const member = clubStore.getMemberById(verified.memberId);
      if (!member) {
        playScanChime(false);
        setScanFlashState('failure');
        setLastScannedResult({
          member: null,
          rawText: trimmed,
          isValid: false,
          reason: `No club member found with reference: ${verified.memberId}`,
        });
        setTimeout(() => setScanFlashState(null), 700);
        setTimeout(() => setIsProcessingMatch(false), 1400);
        return;
      }

      // Success! Trigger immediate green flash and chime
      playScanChime(true);
      setScanFlashState('success');
      setLastScannedResult({
        member,
        rawText: trimmed,
        isValid: true,
      });

      // Vibrate if mobile device
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          // ignore
        }
      }

      // Automatically select and transfer to DoorReceptionView after a brief visual confirmation
      setTimeout(() => {
        setScanFlashState(null);
        stopCameraStream();
        onMemberScanned(member);
      }, 750);
    },
    [isProcessingMatch, onMemberScanned, stopCameraStream]
  );

  // Start camera stream loop
  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraState('requesting');
    setCameraError(null);
    setLastScannedResult(null);
    setIsProcessingMatch(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unsupported');
      setCameraError('Camera API is not supported in this browser. Please use manual search or test badges below.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Check if torch/fill-light is supported on the track
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraState('active');

        // Start scanning loop
        const scanLoop = () => {
          if (!videoRef.current || !canvasRef.current) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (qrCode && qrCode.data) {
              handleDecodedString(qrCode.data);
            }
          }

          animationFrameId.current = requestAnimationFrame(scanLoop);
        };

        animationFrameId.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      setCameraState('denied');
      const errName = (err as Error)?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError('Camera access denied by user or device security policy. Enable camera permission in browser settings.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('No video input camera detected on this system.');
      } else {
        setCameraError((err as Error)?.message || 'Failed to initialize video camera.');
      }
    }
  }, [facingMode, handleDecodedString, stopCameraStream]);

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch constraint error:', err);
      }
    }
  };

  // Flip Camera (Front / Rear)
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle Manual lookup
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    if (!manualCode.trim()) return;

    handleDecodedString(manualCode.trim());
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCamera, stopCameraStream]);

  if (!isOpen) return null;

  const allMembers = clubStore.getMembers();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-xl rounded-2xl bg-[#121214] border-2 border-[#581625] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fadeIn">
        {/* Header Bar */}
        <div className="p-4 bg-gradient-to-r from-[#2A0C14] via-[#161214] to-[#121214] border-b border-[#3E101B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3E101B] border border-[#C6A052]/50 flex items-center justify-center text-[#E5C378]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#E5C378]">
                Reception Camera Scanner
              </h2>
              <div className="text-[11px] font-mono text-stone-400">
                23 Frith Street · Dynamic QR Verification
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {cameraState === 'active' && (
              <>
                {hasTorch && (
                  <button
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-lg border text-xs transition-colors ${
                      torchOn
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-[#1C181A] border-[#3E101B] text-stone-400 hover:text-white'
                    }`}
                    title="Toggle Flash / Torch"
                  >
                    {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}

                <button
                  onClick={handleFlipCamera}
                  className="p-2 rounded-lg bg-[#1C181A] hover:bg-[#251F22] border border-[#3E101B] text-stone-300 hover:text-white transition-colors"
                  title="Flip front/rear camera"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="p-2 rounded-lg bg-[#1C181A] hover:bg-[#282124] text-stone-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Frame */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[320px] sm:min-h-[380px]">
          {/* Real Live Video */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover min-h-[320px] sm:min-h-[380px] max-h-[440px] ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
            muted
            playsInline
          />

          {/* Flash Feedback Layer (Green on Success, Red on Failure) */}
          {scanFlashState === 'success' && (
            <div className="absolute inset-0 pointer-events-none z-30 animate-scan-success border-4 border-emerald-400" />
          )}
          {scanFlashState === 'failure' && (
            <div className="absolute inset-0 pointer-events-none z-30 animate-scan-failure border-4 border-rose-500" />
          )}

          {/* Camera Requesting / Loading State */}
          {cameraState === 'requesting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B090A] p-6 text-center z-10">
              <div className="w-12 h-12 rounded-full border-2 border-[#C6A052] border-t-transparent animate-spin mb-3" />
              <div className="font-serif text-lg font-bold text-[#E5C378]">
                Requesting Door Camera Stream...
              </div>
              <div className="text-xs text-stone-400 mt-1 max-w-xs">
                Allow browser camera permissions to begin scanning digital member passes.
              </div>
            </div>
          )}

          {/* Camera Denied or Unsupported State */}
          {(cameraState === 'denied' || cameraState === 'unsupported') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#100D0F] p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/70 border border-rose-600/50 flex items-center justify-center text-rose-400 mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="font-serif text-lg font-bold text-rose-300">
                Camera Access Unavailable
              </div>
              <div className="text-xs text-stone-400 mt-1 mb-4 max-w-sm">
                {cameraError || 'Device camera could not be accessed. You can still scan members using simulated tokens or manual reference entry below.'}
              </div>
              <button
                onClick={startCamera}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-[#2D161C] hover:bg-[#3D1E26] border border-[#581625] text-[#E5C378] text-xs font-mono font-medium transition-colors active:scale-95 touch-manipulation"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Authorization</span>
              </button>
            </div>
          )}

          {/* Art Deco Gold Viewfinder Reticle Overlay with scannerLaser Animation */}
          {cameraState === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Dimmed Vignette Mask */}
              <div className="absolute inset-0 bg-black/45" />

              {/* Viewfinder Scanning Box (iPad-Optimized ~280px) */}
              <div
                className={`relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 border-2 transition-all duration-300 rounded-2xl ${
                  scanFlashState === 'success' || (lastScannedResult?.isValid)
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_40px_rgba(52,211,153,0.7)]'
                    : scanFlashState === 'failure' || (lastScannedResult && !lastScannedResult.isValid)
                    ? 'border-rose-500 bg-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.7)]'
                    : 'border-[#C6A052]/90 shadow-[0_0_24px_rgba(198,160,82,0.3)]'
                }`}
              >
                {/* Art Deco Gold Corner Accents */}
                <div
                  className={`absolute -top-1.5 -left-1.5 w-7 h-7 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-200 ${
                    scanFlashState === 'success'
                      ? 'border-emerald-400'
                      : scanFlashState === 'failure'
                      ? 'border-rose-500'
                      : 'border-[#E5C378]'
                  }`}
                />
                <div
                  className={`absolute -top-1.5 -right-1.5 w-7 h-7 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-200 ${
                    scanFlashState === 'success'
                      ? 'border-emerald-400'
                      : scanFlashState === 'failure'
                      ? 'border-rose-500'
                      : 'border-[#E5C378]'
                  }`}
                />
                <div
                  className={`absolute -bottom-1.5 -left-1.5 w-7 h-7 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-200 ${
                    scanFlashState === 'success'
                      ? 'border-emerald-400'
                      : scanFlashState === 'failure'
                      ? 'border-rose-500'
                      : 'border-[#E5C378]'
                  }`}
                />
                <div
                  className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 border-b-4 border-r-4 rounded-br-lg transition-colors duration-200 ${
                    scanFlashState === 'success'
                      ? 'border-emerald-400'
                      : scanFlashState === 'failure'
                      ? 'border-rose-500'
                      : 'border-[#E5C378]'
                  }`}
                />

                {/* Animated Laser Scanning Line (Powered by scannerLaser keyframe in index.css) */}
                <div
                  className={`absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#E5C378] to-transparent shadow-[0_0_12px_#E5C378] animate-[scannerLaser_2.4s_ease-in-out_infinite] ${
                    scanFlashState === 'success'
                      ? 'via-emerald-300 shadow-[0_0_14px_#34D399]'
                      : scanFlashState === 'failure'
                      ? 'via-rose-400 shadow-[0_0_14px_#F43F5E]'
                      : ''
                  }`}
                />

                {/* Center Reticle Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-[#C6A052]/60 rounded-full flex items-center justify-center opacity-75">
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      scanFlashState === 'success'
                        ? 'bg-emerald-400'
                        : scanFlashState === 'failure'
                        ? 'bg-rose-500'
                        : 'bg-[#E5C378]'
                    }`}
                  />
                </div>
              </div>

              {/* Aiming Guidance Text with high contrast */}
              <div className="absolute bottom-5 inset-x-0 text-center">
                <span className="px-4 py-1.5 rounded-full bg-black/85 backdrop-blur-md text-[#E5C378] text-xs font-mono border border-[#C6A052]/40 shadow-xl tracking-wide">
                  Align Member Card QR inside the gold frame
                </span>
              </div>
            </div>
          )}

          {/* Instant Match Overlay Banner */}
          {lastScannedResult && (
            <div className="absolute inset-x-4 top-4 z-20 animate-fadeIn">
              {lastScannedResult.isValid && lastScannedResult.member ? (
                <div className="p-4 rounded-xl bg-[#141214]/95 border-2 border-emerald-500 shadow-2xl backdrop-blur-md flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/90 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                        IDENTIFIED MEMBER
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-600/40">
                        {lastScannedResult.member.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-serif text-lg font-bold text-white truncate">
                      {lastScannedResult.member.fullName}
                    </div>
                    <div className="text-[11px] font-mono text-[#C6A052]">
                      {lastScannedResult.member.memberNumber} · {lastScannedResult.member.hospitalityRole} at {lastScannedResult.member.employer}
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
                      QR VERIFICATION FAILED
                    </div>
                    <div className="text-xs text-rose-200 mt-0.5">
                      {lastScannedResult.reason || 'Invalid QR code'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Drawer: Manual Input & One-Tap Direct Scans */}
        <div className="p-4 bg-[#120F11] border-t border-[#2B0A13] space-y-3.5 overflow-y-auto max-h-56">
          {/* Quick Manual Entry Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type Member No. (e.g. JNY-0842) / token..."
                className="w-full px-3.5 py-2 bg-[#0B0809] border border-[#3E101B] rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#581625] hover:bg-[#6D1B2E] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-bold shrink-0 transition-colors"
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

          {/* Quick Test Member Badges */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1.5 flex items-center justify-between">
              <span>One-Tap Test Card Simulation:</span>
              <span className="text-[#C6A052]">Auto-Lookup</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {allMembers.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleDecodedString(m.memberNumber)}
                  className="p-2 rounded-lg bg-[#181316] hover:bg-[#251C21] border border-[#2B0A13] flex items-center justify-between text-left transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-medium text-stone-200 truncate">
                      {m.fullName}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono truncate">
                      {m.memberNumber} · {m.hospitalityRole}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                      m.status === 'active'
                        ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30'
                        : m.status === 'waiting_48_hours'
                        ? 'border-amber-500/50 text-amber-300 bg-amber-950/30'
                        : 'border-rose-500/50 text-rose-300 bg-rose-950/30'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-[#0E0C0E] border-t border-[#230C13] flex justify-between items-center text-xs text-stone-500">
          <span className="font-mono text-[11px]">
            Door Capacity: <strong className="text-stone-300">{currentCustomerCount}/80</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-[#1E181B] hover:bg-[#2A2125] text-stone-300 font-medium text-xs transition-colors"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};

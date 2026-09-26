import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  getVenueCurrentDate,
  setSimulatedVenueTime,
  isTimeSimulationEnabled,
  subscribeToStore,
} from '../../services/storage';
import { getNightModeState } from '../../services/ruleEngine';

interface VenueTimeControllerProps {
  onOpenTestRunner?: () => void;
}

export const VenueTimeController: React.FC<VenueTimeControllerProps> = ({ onOpenTestRunner }) => {
  const [currentDate, setCurrentDate] = useState<Date>(getVenueCurrentDate());
  const [showSimMenu, setShowSimMenu] = useState(false);
  const isSimulated = isTimeSimulationEnabled();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(getVenueCurrentDate());
    }, 1000);

    const unsub = subscribeToStore(() => {
      setCurrentDate(getVenueCurrentDate());
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const nightMode = getNightModeState(currentDate);

  // Format London time string
  const timeString = currentDate.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const setPresetTime = (hours: number, minutes: number, seconds: number = 0) => {
    const target = new Date(currentDate);
    target.setHours(hours, minutes, seconds, 0);
    setSimulatedVenueTime(target);
    setShowSimMenu(false);
  };

  const handleResetToRealTime = () => {
    setSimulatedVenueTime(null);
    setShowSimMenu(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Mode & Time Indicator Pill */}
      <div
        onClick={() => setShowSimMenu(!showSimMenu)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
          nightMode.mode === 'no_new_admissions'
            ? 'bg-[#3E101B]/80 border-rose-500/50 text-rose-200'
            : nightMode.mode === 'members_mode'
            ? 'bg-[#38240D]/80 border-amber-500/50 text-amber-200'
            : 'bg-[#141416] border-[#3E101B]/60 text-stone-300'
        }`}
        title="Click to simulate venue operating hours (00:59, 01:00, 01:29, 01:30)"
      >
        <Clock className={`w-3.5 h-3.5 ${isSimulated ? 'text-amber-400 animate-pulse' : 'text-stone-400'}`} />
        <span className="font-mono text-xs font-semibold tracking-wider text-[#E5C378]">
          {timeString}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium opacity-90 hidden sm:inline">
          {nightMode.mode === 'no_new_admissions'
            ? '01:30 CURFEW'
            : nightMode.mode === 'members_mode'
            ? '01:00 MEMBERS'
            : 'NORMAL'}
        </span>
        {isSimulated && (
          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded border border-amber-500/30">
            SIM
          </span>
        )}
      </div>

      {/* Automated Boundary Tests trigger button */}
      {onOpenTestRunner && (
        <button
          onClick={onOpenTestRunner}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#C6A052] bg-[#161214] hover:bg-[#221B1E] border border-[#C6A052]/30 rounded-lg transition-colors"
          title="Run automated licensing boundary tests"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#E5C378]" />
          <span className="hidden md:inline">Licence Tests</span>
        </button>
      )}

      {/* Simulation Dropdown Modal */}
      {showSimMenu && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-xl bg-[#121214] border border-[#581625] shadow-2xl p-3 text-left">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2B0A13]">
            <span className="text-xs font-serif font-bold text-[#E5C378]">
              Venue Clock Controller
            </span>
            {isSimulated && (
              <button
                onClick={handleResetToRealTime}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset Real Time
              </button>
            )}
          </div>

          <p className="text-[11px] text-stone-400 mb-3 leading-normal">
            Simulate exact statutory cutoff timestamps to verify automatic system transitions.
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setPresetTime(0, 59, 0)}
              className="px-2.5 py-2 text-xs text-left rounded bg-[#1C181A] hover:bg-[#282124] border border-[#3E101B] text-stone-200"
            >
              <div className="font-mono text-[#E5C378]">00:59:00</div>
              <div className="text-[10px] text-stone-400">Standard Mode</div>
            </button>

            <button
              onClick={() => setPresetTime(1, 0, 0)}
              className="px-2.5 py-2 text-xs text-left rounded bg-[#2D1E18] hover:bg-[#3D2820] border border-amber-500/40 text-amber-200"
            >
              <div className="font-mono text-amber-300">01:00:00</div>
              <div className="text-[10px] text-amber-300/80">Members Mode</div>
            </button>

            <button
              onClick={() => setPresetTime(1, 29, 50)}
              className="px-2.5 py-2 text-xs text-left rounded bg-[#1C181A] hover:bg-[#282124] border border-[#3E101B] text-stone-200"
            >
              <div className="font-mono text-[#E5C378]">01:29:50</div>
              <div className="text-[10px] text-stone-400">10s to Cutoff</div>
            </button>

            <button
              onClick={() => setPresetTime(1, 30, 0)}
              className="px-2.5 py-2 text-xs text-left rounded bg-[#3E101B] hover:bg-[#501523] border border-rose-500/40 text-rose-200"
            >
              <div className="font-mono text-rose-300">01:30:00</div>
              <div className="text-[10px] text-rose-300/80">No New Admissions</div>
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-[#2B0A13] flex justify-between items-center">
            <span className="text-[10px] text-stone-400">Europe/London BST</span>
            <button
              onClick={() => setShowSimMenu(false)}
              className="text-[11px] text-stone-300 hover:text-white px-2 py-1 rounded bg-[#1E1B1D]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

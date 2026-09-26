import React, { useState } from 'react';
import { X, Flame, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { SmokingPatron, VisitRecord, StaffUser } from '../../types';
import { clubStore } from '../../services/storage';
import { MAX_SMOKERS_OUTSIDE, validateSmokingExit } from '../../services/ruleEngine';

interface SmokingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffUser;
}

export const SmokingManagerModal: React.FC<SmokingManagerModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
}) => {
  const [selectedVisitId, setSelectedVisitId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const smokingPatrons = clubStore.getSmokingPatrons();
  const currentCount = smokingPatrons.length;
  const isFull = currentCount >= MAX_SMOKERS_OUTSIDE;

  // Active checked-in patrons currently inside who are not already smoking
  const activeVisits = clubStore
    .getVisits()
    .filter((v) => v.isCurrentlyInside && !v.isOutToSmoke);

  const filteredVisits = activeVisits.filter(
    (v) =>
      v.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.memberNumber && v.memberNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleMarkOutToSmoke = (visit: VisitRecord) => {
    setErrorMessage(null);
    const validation = validateSmokingExit(currentCount);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'Smoking capacity reached.');
      return;
    }

    clubStore.markOutToSmoke({
      visitId: visit.id,
      name: `${visit.memberName} (${visit.attendeeType === 'member' ? 'Member' : 'Guest'})`,
      type: visit.attendeeType === 'proprietor_guest' ? 'proprietor_guest' : visit.attendeeType === 'member_guest' ? 'guest' : 'member',
    });

    clubStore.addAuditLog({
      actorId: currentStaff.id,
      actorName: currentStaff.name,
      actorRole: currentStaff.role,
      action: 'SMOKING_EXIT',
      targetType: 'smoking',
      targetId: visit.id,
      targetName: visit.memberName,
      newValue: `Smokers: ${currentCount + 1} / ${MAX_SMOKERS_OUTSIDE}`,
    });

    setSelectedVisitId('');
  };

  const handleMarkReturned = (patron: SmokingPatron) => {
    setErrorMessage(null);
    clubStore.markSmokingReturned(patron.id);

    clubStore.addAuditLog({
      actorId: currentStaff.id,
      actorName: currentStaff.name,
      actorRole: currentStaff.role,
      action: 'SMOKING_RETURN',
      targetType: 'smoking',
      targetId: patron.id,
      targetName: patron.name,
      newValue: `Smokers: ${currentCount - 1} / ${MAX_SMOKERS_OUTSIDE}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#200A10] to-[#141214] border-b border-[#3E101B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3E101B] border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#E5C378]">
                Frith Street Smoking Area
              </h2>
              <div className="text-xs text-stone-400">
                Licensing Condition: Max {MAX_SMOKERS_OUTSIDE} patrons outside at any one time
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-lg hover:bg-[#1F1B1D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Capacity Gauge */}
        <div className="p-4 bg-[#161214] border-b border-[#2B0A13]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-stone-300">
              Current Smokers Outside
            </span>
            <span
              className={`font-mono text-base font-bold ${
                isFull ? 'text-rose-400' : currentCount >= 8 ? 'text-amber-400' : 'text-[#E5C378]'
              }`}
            >
              {currentCount} / {MAX_SMOKERS_OUTSIDE}
            </span>
          </div>

          <div className="w-full bg-[#201A1D] h-3 rounded-full overflow-hidden border border-[#3E101B]">
            <div
              className={`h-full transition-all duration-300 ${
                isFull ? 'bg-rose-600' : currentCount >= 8 ? 'bg-amber-500' : 'bg-[#C6A052]'
              }`}
              style={{ width: `${Math.min(100, (currentCount / MAX_SMOKERS_OUTSIDE) * 100)}%` }}
            />
          </div>

          {isFull && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                <strong>Smoking Terrace Full:</strong> Further exits are strictly blocked by system logic until someone returns.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Content Body: Split into Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#2B0A13] flex-1 overflow-y-auto">
          {/* Left Column: Currently Outside (One tap return) */}
          <div className="p-4 flex flex-col">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-300 mb-3 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5" />
              Currently Outside ({currentCount})
            </h3>

            {smokingPatrons.length === 0 ? (
              <div className="text-center py-10 text-xs text-stone-500 border border-dashed border-[#2B0A13] rounded-xl my-auto">
                No patrons currently outside.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                {smokingPatrons.map((patron) => {
                  const exitTime = new Date(patron.exitTimestamp);
                  const minutesOut = Math.floor((Date.now() - exitTime.getTime()) / 60000);
                  const isOvertime = minutesOut >= 10;

                  return (
                    <div
                      key={patron.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isOvertime
                          ? 'bg-rose-950/30 border-rose-800/60'
                          : 'bg-[#181316] border-[#3E101B]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-200 truncate">
                          {patron.name}
                        </div>
                        <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                          Out for {minutesOut}m {isOvertime && '(exceeds 10m guidance)'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkReturned(patron)}
                        className="px-3 py-1.5 rounded-lg bg-[#2E161C] hover:bg-[#431F27] border border-[#C6A052]/50 text-[#E5C378] text-xs font-medium shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Returned
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Send Patron Out */}
          <div className="p-4 flex flex-col">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-300 mb-2">
              Send Patron Out to Smoke
            </h3>
            <p className="text-[11px] text-stone-400 mb-3">
              Select any currently checked-in patron to authorise a 10-minute temporary smoking exit.
            </p>

            <input
              type="text"
              placeholder="Search patron or member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isFull}
              className="w-full mb-3 px-3 py-2 bg-[#0E0C0E] border border-[#2B0A13] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C6A052] disabled:opacity-50"
            />

            <div className="space-y-1.5 overflow-y-auto max-h-[250px] pr-1 flex-1">
              {filteredVisits.length === 0 ? (
                <div className="text-center py-8 text-xs text-stone-500 border border-dashed border-[#2B0A13] rounded-xl">
                  {searchTerm ? 'No matching patrons inside.' : 'No other patrons currently inside.'}
                </div>
              ) : (
                filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg bg-[#181416] hover:bg-[#201A1D] border border-[#2B0A13] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-stone-200 truncate">
                        {v.memberName}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {v.memberNumber || v.attendeeType.replace('_', ' ')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleMarkOutToSmoke(v)}
                      disabled={isFull}
                      className="px-2.5 py-1.5 rounded-md bg-[#581625] hover:bg-[#6D1B2E] text-[#E5C378] text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                    >
                      <span>Exit</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141214] border-t border-[#2B0A13] flex justify-between items-center text-xs text-stone-400">
          <span>Responsible Door Supervisor: <strong>{currentStaff.name}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#221B1E] hover:bg-[#2E2428] text-stone-200 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

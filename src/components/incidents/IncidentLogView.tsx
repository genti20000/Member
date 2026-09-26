import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Camera,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { IncidentCategory, IncidentRecord, StaffUser } from '../../types';
import { clubStore } from '../../services/storage';
import { IncidentLoggerModal } from '../door/IncidentLoggerModal';

interface IncidentLogViewProps {
  currentStaff: StaffUser;
}

export const IncidentLogView: React.FC<IncidentLogViewProps> = ({ currentStaff }) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>(clubStore.getIncidents());
  const [showLogModal, setShowLogModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredIncidents = incidents.filter((inc) => {
    const matchesCategory = selectedCategory === 'all' || inc.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      inc.incidentNumber.toLowerCase().includes(q) ||
      inc.categoryLabel.toLowerCase().includes(q) ||
      inc.description.toLowerCase().includes(q) ||
      inc.actionTaken.toLowerCase().includes(q) ||
      (inc.personsInvolved && inc.personsInvolved.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#200A11] via-[#141012] to-[#141012] border border-[#3E101B] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#E5C378]">
              Statutory Incident Register
            </h1>
            <span className="px-2.5 py-0.5 rounded bg-[#3E101B] border border-rose-500/40 text-rose-300 text-[10px] font-mono uppercase tracking-wider">
              Premises Licence s.141 & Safety Log
            </span>
          </div>
          <p className="text-xs text-stone-300 mt-1">
            Mandatory log of crimes, ejections, disorder, seizures, refusals, and statutory inspections.
          </p>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#581625] hover:bg-[#6E1C2F] border border-[#C6A052]/50 text-[#E5C378] text-xs font-mono font-bold shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Incident</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search incidents by keyword, number, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none w-64"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
          >
            <option value="all">All Statutory Categories</option>
            <option value="refusals_alcohol_sales">Refusals of Alcohol Sales</option>
            <option value="police_council_visits">Police & Council Visits</option>
            <option value="ejections">Ejections</option>
            <option value="disorder_incidents">Disorder Incidents</option>
            <option value="drug_weapon_seizures">Drug & Weapon Seizures</option>
            <option value="cctv_faults">CCTV Faults</option>
          </select>
        </div>

        <div className="text-xs font-mono text-stone-400">
          Total Recorded: <strong>{filteredIncidents.length}</strong>
        </div>
      </div>

      {/* Incidents Cards / Rows */}
      <div className="space-y-3">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-12 text-xs text-stone-500 rounded-2xl bg-[#120F11] border border-[#2B0A13]">
            No matching incidents found.
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              className="p-5 rounded-2xl bg-[#120F11] hover:bg-[#161214] border border-[#2B0A13] transition-colors shadow-lg"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#200A11]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#E5C378]">
                    {inc.incidentNumber}
                  </span>
                  <span className="text-stone-500">·</span>
                  <span className="text-xs font-mono uppercase tracking-wider text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                    {inc.categoryLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-400 font-mono">
                  <span>
                    {new Date(inc.timestamp).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="py-3 text-xs sm:text-sm text-stone-200 leading-relaxed">
                {inc.description}
              </div>

              {/* Action Taken & Metadata */}
              <div className="p-3 rounded-xl bg-[#0B080A] border border-[#230C13] space-y-1.5 text-xs">
                <div>
                  <strong className="text-amber-400/90 font-mono text-[11px] uppercase">
                    Action Taken:
                  </strong>{' '}
                  <span className="text-stone-300">{inc.actionTaken}</span>
                </div>

                {inc.personsInvolved && (
                  <div>
                    <strong className="text-stone-400 font-mono text-[11px] uppercase">
                      Persons Involved:
                    </strong>{' '}
                    <span className="text-stone-300">{inc.personsInvolved}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-stone-400 font-mono">
                  {inc.cctvReference && (
                    <span className="flex items-center gap-1 text-[#C6A052]">
                      <Camera className="w-3.5 h-3.5" /> CCTV Ref: {inc.cctvReference}
                    </span>
                  )}

                  {inc.policeIncidentNumber && (
                    <span className="text-amber-300">
                      CAD/Police Ref: {inc.policeIncidentNumber}
                    </span>
                  )}

                  <span className="ml-auto text-stone-500">
                    Logged by {inc.staffMemberName}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <IncidentLoggerModal
        isOpen={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setIncidents(clubStore.getIncidents());
        }}
        currentStaff={currentStaff}
      />
    </div>
  );
};

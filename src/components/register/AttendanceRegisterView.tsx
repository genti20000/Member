import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Shield,
  Eye,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { VisitRecord, CapacitySnapshot } from '../../types';
import { clubStore } from '../../services/storage';

export const AttendanceRegisterView: React.FC = () => {
  const [isAuthorityView, setIsAuthorityView] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const visits = clubStore.getVisits();
  const hourlyCapacities = clubStore.getHourlyCapacities();
  const stats = clubStore.getCapacityStats();

  const filteredVisits = visits.filter((v) => {
    const matchesDate = !selectedDate || v.date === selectedDate;
    const matchesCategory =
      categoryFilter === 'all' || v.attendeeType === categoryFilter;
    return matchesDate && matchesCategory;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Date',
      'Category',
      'Attendee Name',
      'Member Number',
      'Named Guests',
      'Check-In Time',
      'Check-Out Time',
      'Currently Inside',
      'Responsible Staff',
    ];

    const rows = filteredVisits.map((v) => [
      v.id,
      v.date,
      v.attendeeType,
      `"${v.memberName.replace(/"/g, '""')}"`,
      v.memberNumber || 'N/A',
      `"${(v.guestNames || []).join('; ')}"`,
      v.checkInTime,
      v.checkOutTime || 'Active Inside',
      v.isCurrentlyInside ? 'YES' : 'NO',
      `"${v.responsibleStaffName}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `JONNYS_SOHO_ATTENDANCE_${selectedDate || 'ALL'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable Inspection Authority View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Authority Mode Toggle */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E1115] via-[#141012] to-[#141012] border border-[#3E101B] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#E5C378]">
              Attendance & Licensing Register
            </h1>
            {isAuthorityView && (
              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono uppercase tracking-wider">
                Authority View
              </span>
            )}
          </div>
          <p className="text-xs text-stone-300 mt-1">
            Statutory 31-day door register, customer occupancy logs, and Westminster Licensing inspection export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Authority View Toggle */}
          <button
            onClick={() => setIsAuthorityView(!isAuthorityView)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              isAuthorityView
                ? 'bg-amber-600 text-black font-bold shadow-lg'
                : 'bg-[#22161A] text-stone-300 hover:text-white border border-[#3E101B]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{isAuthorityView ? 'Authority View (Active)' : 'Authority Inspection View'}</span>
          </button>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1417] hover:bg-[#251D21] border border-[#C6A052]/40 text-[#E5C378] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Print/PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1417] hover:bg-[#251D21] border border-stone-700 text-stone-200 text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* Authority Notice if enabled */}
      {isAuthorityView && (
        <div className="p-4 rounded-xl bg-[#1E1710] border border-amber-500/50 text-amber-200 text-xs flex items-start gap-3">
          <Shield className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-300">
              Westminster City Council & Police Authority Inspection Display
            </div>
            <div className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
              Displaying solely statutory door admission records: timestamps, attendee category, member identification numbers, named guests, and responsible SIA door supervisor. Private member contact notes and financial records are suppressed in accordance with GDPR and licensing inspection protocols.
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-[#120F11] border border-[#2B0A13] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Calendar className="w-4 h-4 text-[#C6A052]" />
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0B090A] border border-[#3E101B] rounded-lg text-xs text-stone-200 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="member">Members</option>
              <option value="member_guest">Member Guests</option>
              <option value="proprietor_guest">Proprietor Guests</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-stone-400">
          Showing <strong>{filteredVisits.length}</strong> records
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-5 shadow-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#240D16] text-stone-400 font-mono uppercase text-[10px]">
              <th className="pb-3">Timestamp</th>
              <th className="pb-3">Admission Type</th>
              <th className="pb-3">Attendee Name</th>
              <th className="pb-3">Member ID</th>
              <th className="pb-3">Named Guests Accompanied</th>
              <th className="pb-3">Exit / Status</th>
              <th className="pb-3">Door Supervisor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B0C12]">
            {filteredVisits.map((v) => (
              <tr key={v.id} className="hover:bg-[#181316]/60 transition-colors">
                <td className="py-3 font-mono text-stone-300">
                  {new Date(v.checkInTime).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3">
                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
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
                  {v.memberName}
                </td>
                <td className="py-3 font-mono text-[#C6A052]">
                  {v.memberNumber || '—'}
                </td>
                <td className="py-3 text-stone-300">
                  {v.guestNames && v.guestNames.length > 0 ? (
                    <div className="space-y-0.5">
                      {v.guestNames.map((g, idx) => (
                        <div key={idx} className="font-medium text-stone-200 text-[11px]">
                          · {g}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </td>
                <td className="py-3 font-mono">
                  {v.isCurrentlyInside ? (
                    v.isOutToSmoke ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Out to smoke
                      </span>
                    ) : (
                      <span className="text-emerald-400">Currently Inside</span>
                    )
                  ) : (
                    <span className="text-stone-500">
                      Out at {new Date(v.checkOutTime || '').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </td>
                <td className="py-3 text-stone-400">
                  {v.responsibleStaffName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hourly Capacity Snapshots & Audit Log */}
      <div className="rounded-2xl bg-[#120F11] border border-[#2B0A13] p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#240D16]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C6A052]" />
            <h2 className="font-serif text-lg font-bold text-stone-200">
              Statutory Hourly Occupancy Record (Max 80 Customers)
            </h2>
          </div>
          <button
            onClick={() => clubStore.recordHourlyCapacitySnapshot()}
            className="px-3 py-1 rounded-lg bg-[#241318] hover:bg-[#341B23] border border-[#581625] text-[#E5C378] text-xs font-mono"
          >
            + Snapshot Now
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {hourlyCapacities.slice(0, 5).map((cap) => (
            <div
              key={cap.id}
              className="p-3.5 rounded-xl bg-[#0E0C0E] border border-[#2B0A13] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                <span>
                  {new Date(cap.timestamp).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-[10px] text-emerald-400">Compliant</span>
              </div>

              <div className="my-2">
                <div className="font-mono text-2xl font-bold text-[#E5C378]">
                  {cap.customerCount} <span className="text-xs text-stone-500">/ 80</span>
                </div>
                <div className="w-full bg-[#1C1417] h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-[#C6A052]"
                    style={{ width: `${(cap.customerCount / 80) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-[10px] text-stone-400 font-mono space-y-0.5 pt-1 border-t border-[#1C0E14]">
                <div>Members: {cap.membersCount} · Guests: {cap.memberGuestsCount}</div>
                <div>Proprietor: {cap.proprietorGuestsCount} · Smokers: {cap.smokersOutside}</div>
                <div>Staff (excluded): {cap.staffCount}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

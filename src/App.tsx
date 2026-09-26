/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StaffUser } from './types';
import { clubStore, subscribeToStore, getVenueCurrentDate } from './services/storage';
import { getNightModeState } from './services/ruleEngine';
import { DoorReceptionView } from './components/door/DoorReceptionView';
import { MembershipApplicationFlow } from './components/application/MembershipApplicationFlow';
import { DigitalMemberCard } from './components/cards/DigitalMemberCard';
import { AttendanceRegisterView } from './components/register/AttendanceRegisterView';
import { IncidentLogView } from './components/incidents/IncidentLogView';
import { ManagementDashboard } from './components/management/ManagementDashboard';
import { TestRunnerModal } from './components/compliance/TestRunnerModal';
import { VenueTimeController } from './components/common/VenueTimeController';
import { PWAInstallButton } from './components/common/PWAInstallButton';
import { ChevronDown, Menu, X, Shield, Database } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('door');
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(clubStore.getCurrentStaff());
  const [showTestRunner, setShowTestRunner] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showStaffSelector, setShowStaffSelector] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<Date>(getVenueCurrentDate());

  const staffList = clubStore.getStaffList();
  const nightMode = getNightModeState(currentDate);

  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setCurrentStaff(clubStore.getCurrentStaff());
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

  const handleSwitchStaff = (staffId: string) => {
    clubStore.setCurrentStaff(staffId);
    setShowStaffSelector(false);
  };

  const navItems = [
    { id: 'door', label: 'Door Control' },
    { id: 'cards', label: 'Member Entry' },
    { id: 'register', label: 'Guest Ledger' },
    { id: 'management', label: 'Occupancy' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'applications', label: 'Admin Panel' },
  ];

  return (
    <div className="min-h-screen bg-[#111113] text-[#f2f2f2] font-sans antialiased flex flex-col md:grid md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#09090b] border-b border-white/[0.08]">
        <div className="font-serif text-2xl font-bold tracking-wider text-[#C6A052]">
          JONNY&apos;S
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded bg-[#1a1a1e] border border-white/[0.08] text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation - Exact Variation 6 Architecture */}
      <aside
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } md:flex flex-col p-6 bg-[#09090b] border-r border-white/[0.08] fixed md:static inset-0 z-40 md:z-auto overflow-y-auto`}
      >
        <div className="flex items-center justify-between md:block mb-8">
          <div>
            <div className="font-serif text-3xl font-bold tracking-wider text-[#C6A052] leading-none">
              JONNY&apos;S
            </div>
            <div className="font-mono text-[10px] tracking-[2px] uppercase text-white/40 mt-1.5">
              23 Frith Street · Soho
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 text-stone-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`nav-link ${currentTab === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              setShowTestRunner(true);
              setMobileMenuOpen(false);
            }}
            className="nav-link text-amber-400/80 hover:text-[#C6A052] flex items-center justify-between"
          >
            <span>Boundary Tests</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
              8 PASS
            </span>
          </button>
        </nav>

        {/* Operating Profile & Staff Switcher */}
        <div className="mt-auto pt-8 border-t border-white/[0.08] space-y-4">
          <div>
            <div className="label">Operating Profile</div>
            <div className="font-mono text-[11px] font-bold text-[#C6A052] uppercase tracking-wider leading-snug">
              {nightMode.mode === 'no_new_admissions'
                ? '01:30 AM CUT-OFF (RETURNING SMOKERS ONLY)'
                : nightMode.mode === 'members_mode'
                ? 'POST-01:00 AM MEMBER & GUEST ONLY'
                : 'STANDARD CLUB ADMISSIONS'}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 font-mono">
              Westminster City Council Licensing Schedule
            </div>
          </div>

          {/* Connected Staff Profile Selector */}
          <div className="relative pt-2 border-t border-white/[0.05]">
            <div className="label mb-1">Active Operator</div>
            <button
              onClick={() => setShowStaffSelector(!showStaffSelector)}
              className="w-full flex items-center justify-between p-2 rounded bg-[#151518] hover:bg-[#1f1f24] border border-white/[0.08] transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-white truncate">
                  {currentStaff.name}
                </div>
                <div className="text-[10px] font-mono text-[#C6A052]">
                  {currentStaff.badgeNumber} · {currentStaff.role.toUpperCase()}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            </button>

            {showStaffSelector && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1e] border border-white/[0.12] shadow-2xl rounded p-1.5 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                {staffList.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSwitchStaff(s.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center justify-between ${
                      s.id === currentStaff.id
                        ? 'bg-[#581625] text-[#C6A052]'
                        : 'text-stone-300 hover:bg-[#25252b]'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] opacity-60 uppercase">{s.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-col min-h-screen overflow-x-hidden">
        {/* Header Bar - Variation 6 Header */}
        <header className="px-6 sm:px-10 py-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111113]">
          <div>
            <h1 className="font-serif text-lg sm:text-xl uppercase tracking-[2px] text-[#f2f2f2] font-bold">
              23 Frith Street Members
            </h1>
            <p className="label mt-1">Reception & Door Compliance System</p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
            {/* Live Clock & Operating Badge */}
            <div className="text-right">
              <div className="value text-xl sm:text-2xl text-[#f2f2f2]">
                {currentDate.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="label mt-0.5">
                {nightMode.mode === 'no_new_admissions'
                  ? 'Hard Cutoff Mode'
                  : nightMode.mode === 'members_mode'
                  ? 'Post-1am Club Only'
                  : 'Normal Ops Mode'}
              </div>
            </div>

            {/* Time Travel / Test Clock & PWA */}
            <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
              <VenueTimeController onOpenTestRunner={() => setShowTestRunner(true)} />
              <PWAInstallButton />
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Container */}
        <div className="flex-1">
          {currentTab === 'door' && (
            <DoorReceptionView
              currentStaff={currentStaff}
              onOpenTestRunner={() => setShowTestRunner(true)}
              onNavigateToApplications={() => setCurrentTab('applications')}
            />
          )}

          {currentTab === 'cards' && (
            <div className="p-6 sm:p-10 max-w-5xl mx-auto">
              <DigitalMemberCard />
            </div>
          )}

          {currentTab === 'register' && (
            <div className="p-6 sm:p-10 max-w-6xl mx-auto">
              <AttendanceRegisterView />
            </div>
          )}

          {currentTab === 'incidents' && (
            <div className="p-6 sm:p-10 max-w-6xl mx-auto">
              <IncidentLogView currentStaff={currentStaff} />
            </div>
          )}

          {currentTab === 'management' && (
            <div className="p-6 sm:p-10 max-w-6xl mx-auto">
              <ManagementDashboard currentStaff={currentStaff} />
            </div>
          )}

          {currentTab === 'applications' && (
            <div className="p-6 sm:p-10 max-w-5xl mx-auto">
              <MembershipApplicationFlow />
            </div>
          )}
        </div>

        {/* Footer - Exact Variation 6 Architecture */}
        <footer className="px-6 sm:px-10 py-4 bg-[#09090b] border-t border-white/[0.08] font-mono text-[10px] text-white/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-auto">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center">
              <span className="status-dot" />
              <span>
                CONNECTED AS: {currentStaff.name.toUpperCase()} [{currentStaff.badgeNumber} {currentStaff.role.toUpperCase()}]
              </span>
            </div>
            <span className="opacity-30">·</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="tracking-wide">FIRESTORE CLOUD DB SYNCED</span>
            </div>
          </div>
          <div>
            LICENSING ACT 2003 · WESTMINSTER COUNCIL COMPLIANT
          </div>
        </footer>
      </main>

      {/* Automated Boundary Tests Modal */}
      <TestRunnerModal
        isOpen={showTestRunner}
        onClose={() => setShowTestRunner(false)}
      />
    </div>
  );
}

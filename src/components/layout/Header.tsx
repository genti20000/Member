import React, { useState } from 'react';
import { UserCheck, Shield, ChevronDown } from 'lucide-react';
import { StaffUser, UserRole } from '../../types';
import { clubStore } from '../../services/storage';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { VenueTimeController } from '../common/VenueTimeController';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentStaff: StaffUser;
  onOpenTestRunner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentStaff,
  onOpenTestRunner,
}) => {
  const [showStaffSelector, setShowStaffSelector] = useState(false);
  const staffList = clubStore.getStaffList();

  const handleSwitchStaff = (staffId: string) => {
    clubStore.setCurrentStaff(staffId);
    setShowStaffSelector(false);
  };

  const navItems = [
    { id: 'door', label: 'Door & Reception' },
    { id: 'applications', label: 'Apply' },
    { id: 'cards', label: 'Digital Cards' },
    { id: 'register', label: 'Register & Occupancy' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'management', label: 'Management' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0C]/95 backdrop-blur-md border-b border-[#2B0A13]">
      {/* Licensing Distinction Banner (Subtle, compliant, persistent) */}
      <div className="bg-[#19080E] border-b border-[#3E101B]/50 px-4 py-1 text-center">
        <p className="text-[11px] text-[#C6A052]/90 tracking-wide">
          <span className="font-semibold text-[#E5C378]">Licensing Operating Schedule:</span> 23 Frith Street Members’ Club arrangements. Club admission eligibility does not override restaurant/alcohol dining conditions.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title, single line */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('door')}
            className="text-left group flex items-center gap-2.5 focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full border border-[#C6A052]/60 bg-[#161012] flex items-center justify-center text-[#E5C378] font-serif font-bold text-base shadow-inner">
              J
            </div>
            <div>
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-wider text-[#E5C378] group-hover:text-amber-200 transition-colors">
                JONNY’S
              </span>
              <span className="ml-2 text-xs font-sans font-semibold tracking-widest text-[#9B7836] uppercase">
                SOHO
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap rounded-md ${
                  isActive
                    ? 'text-[#E5C378] bg-[#221016] border border-[#581625]/80'
                    : 'text-stone-300 hover:text-[#E5C378] hover:bg-[#151214]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <VenueTimeController onOpenTestRunner={onOpenTestRunner} />

          <PWAInstallButton />

          {/* Current Staff / Role Profile */}
          <div className="relative">
            <button
              onClick={() => setShowStaffSelector(!showStaffSelector)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#161214] hover:bg-[#20181C] border border-[#3E101B] transition-colors text-left"
              title="Switch user role"
            >
              <div className="w-6 h-6 rounded-full bg-[#3E101B] border border-[#C6A052]/40 flex items-center justify-center text-[10px] font-bold text-[#E5C378]">
                {currentStaff.role === 'admin' ? 'AD' : currentStaff.role === 'manager' ? 'MG' : currentStaff.role === 'reception' ? 'RC' : 'DR'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[11px] font-semibold text-stone-200 leading-tight">
                  {currentStaff.name.split(' ')[0]}
                </div>
                <div className="text-[9px] uppercase font-mono tracking-wider text-[#C6A052]">
                  {currentStaff.role} · {currentStaff.badgeNumber}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {showStaffSelector && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-xl bg-[#121214] border border-[#581625] shadow-2xl p-2">
                <div className="px-2 py-1.5 text-[10px] font-mono tracking-wider uppercase text-[#9B7836] border-b border-[#2B0A13]">
                  Switch On-Duty User (RBAC)
                </div>
                <div className="mt-1 space-y-1">
                  {staffList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSwitchStaff(s.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                        currentStaff.id === s.id
                          ? 'bg-[#3E101B] text-[#E5C378]'
                          : 'hover:bg-[#1A1618] text-stone-300'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-[10px] opacity-75 font-mono">
                          Badge {s.badgeNumber}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded border border-current">
                        {s.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 bg-[#0E0C0E] border-t border-[#230C13] gap-2">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1 text-xs font-medium whitespace-nowrap rounded-md ${
                isActive
                  ? 'text-[#E5C378] bg-[#2A111A] border border-[#581625]'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};

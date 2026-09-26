/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StaffUser } from './types';
import { clubStore, subscribeToStore } from './services/storage';
import { Header } from './components/layout/Header';
import { DoorReceptionView } from './components/door/DoorReceptionView';
import { MembershipApplicationFlow } from './components/application/MembershipApplicationFlow';
import { DigitalMemberCard } from './components/cards/DigitalMemberCard';
import { AttendanceRegisterView } from './components/register/AttendanceRegisterView';
import { IncidentLogView } from './components/incidents/IncidentLogView';
import { ManagementDashboard } from './components/management/ManagementDashboard';
import { TestRunnerModal } from './components/compliance/TestRunnerModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('door');
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(clubStore.getCurrentStaff());
  const [showTestRunner, setShowTestRunner] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setCurrentStaff(clubStore.getCurrentStaff());
    });
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#E8E6E3] flex flex-col selection:bg-[#581625] selection:text-[#E5C378]">
      {/* Top Bar Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentStaff={currentStaff}
        onOpenTestRunner={() => setShowTestRunner(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentTab === 'door' && (
          <DoorReceptionView
            currentStaff={currentStaff}
            onOpenTestRunner={() => setShowTestRunner(true)}
            onNavigateToApplications={() => setCurrentTab('management')}
          />
        )}

        {currentTab === 'applications' && <MembershipApplicationFlow />}

        {currentTab === 'cards' && <DigitalMemberCard />}

        {currentTab === 'register' && <AttendanceRegisterView />}

        {currentTab === 'incidents' && <IncidentLogView currentStaff={currentStaff} />}

        {currentTab === 'management' && <ManagementDashboard currentStaff={currentStaff} />}
      </main>

      {/* Footer & Licensing Notice */}
      <footer className="bg-[#080708] border-t border-[#230C13] py-6 px-4 text-center text-xs text-stone-500">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="font-serif tracking-widest text-[#C6A052] font-semibold text-sm">
            JONNY’S SOHO
          </div>
          <div className="text-[11px] text-stone-400">
            PETTITT · Dining & Private Hospitality Club at 23 Frith Street, London W1D 4RR
          </div>
          <p className="text-[10px] text-stone-600 max-w-xl mx-auto leading-relaxed pt-1">
            Registered under the Licensing Act 2003 (City of Westminster). Mandatory 48-hour membership eligibility, 80-person customer capacity limit, 1:00 AM member arrangements, 1:30 AM admission curfew, and 10-person smoking terrace protocol enforced programmatically.
          </p>
        </div>
      </footer>

      {/* Automated Boundary Tests Modal */}
      <TestRunnerModal
        isOpen={showTestRunner}
        onClose={() => setShowTestRunner(false)}
      />
    </div>
  );
}

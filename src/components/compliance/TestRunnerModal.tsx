import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, RotateCw, X, AlertCircle } from 'lucide-react';
import { runAllLicensingBoundaryTests, TestResult } from '../../services/testRunner';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<TestResult[]>(runAllLicensingBoundaryTests());
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setResults(runAllLicensingBoundaryTests());
      setIsRunning(false);
    }, 400);
  };

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const allPassed = passedTests === totalTests;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-[#121214] border border-[#581625] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#2B0A13] via-[#1A1215] to-[#121214] border-b border-[#3E101B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3E101B] border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#E5C378]">
                Statutory Licensing Boundary Test Suite
              </h2>
              <div className="text-xs text-stone-300">
                Automated unit verification of strict Westminster Council operating boundaries
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRerun}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#28181E] hover:bg-[#38222A] border border-[#C6A052]/40 text-[#E5C378] text-xs font-mono font-medium disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>Re-run Tests</span>
            </button>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-2 rounded-lg hover:bg-[#1E1B1D]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="p-4 bg-[#161214] border-b border-[#2B0A13] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                allPassed
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-600/50'
              }`}
            >
              {allPassed ? '100% BOUNDARIES SATISFIED' : 'FAILURES DETECTED'}
            </span>
            <span className="text-xs font-mono text-stone-400">
              {passedTests} of {totalTests} statutory tests passing
            </span>
          </div>

          <span className="text-[11px] font-mono text-[#C6A052]">
            Logic Engine: src/services/ruleEngine.ts
          </span>
        </div>

        {/* Results List */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          {results.map((test, idx) => (
            <div
              key={test.id}
              className={`p-4 rounded-xl border transition-colors ${
                test.passed
                  ? 'bg-[#151214] border-[#2A1D20]'
                  : 'bg-rose-950/20 border-rose-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                        [{test.category}]
                      </span>
                      <span className="text-xs font-serif font-bold text-stone-100">
                        {test.name}
                      </span>
                    </div>
                    <div className="text-xs text-stone-300 mt-1">
                      {test.boundaryDescription}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                    test.passed
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30'
                      : 'border-rose-500/40 text-rose-300 bg-rose-950/30'
                  }`}
                >
                  {test.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              {/* Output Details */}
              <div className="mt-3 pt-2 border-t border-[#23171A] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-stone-500 uppercase">Expected: </span>
                  <span className="text-stone-300">{test.expectedOutcome}</span>
                </div>
                <div>
                  <span className="text-stone-500 uppercase">Actual: </span>
                  <span className={test.passed ? 'text-emerald-400' : 'text-rose-400'}>
                    {test.actualOutcome}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141214] border-t border-[#2B0A13] flex justify-between items-center text-xs text-stone-400">
          <span>Licensing Audit: Automated Test Suite Ready for Council Submission</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#221B1E] hover:bg-[#2F252A] text-stone-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

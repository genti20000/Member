import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E5C378] bg-[#1E1612] hover:bg-[#2D1E18] border border-[#C6A052]/40 rounded-lg transition-colors whitespace-nowrap shadow-sm"
        title="Install JONNY'S MEMBERS on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C6A052] bg-[#161214] hover:bg-[#221B1E] border border-[#C6A052]/30 rounded-lg transition-colors whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install iPad/iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#121214] border border-[#581625]/60 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#2B0A13]">
                <h3 className="font-serif text-lg font-semibold text-[#E5C378]">Install for Reception iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-stone-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-4 text-xs text-stone-300 leading-relaxed">
                To run JONNY’S in fullscreen door kiosk mode on iPad:
              </p>
              <ol className="mt-3 space-y-2 text-xs text-stone-300 list-decimal pl-4">
                <li>Tap the <strong>Share</strong> icon in the Safari toolbar.</li>
                <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> in the top right corner.</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-2.5 rounded-lg bg-[#581625] hover:bg-[#6D1B2E] text-[#E5C378] text-xs font-medium border border-[#C6A052]/30 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

import React, { useState } from 'react';
import { X, Shield, FileText, RefreshCw, Scale } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDoc?: 'eula' | 'privacy' | 'terms' | 'refund';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialDoc = 'eula',
}) => {
  const [activeDoc, setActiveDoc] = useState<'eula' | 'privacy' | 'terms' | 'refund'>(initialDoc);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#0c0d12]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-white/90">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <Scale className="w-4 h-4 text-white/70" />
            <h2 className="text-sm font-semibold tracking-wide text-white">Astralyr Legal & Policies</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-4">
          {[
            { id: 'eula', label: 'EULA', icon: FileText },
            { id: 'privacy', label: 'Privacy Policy', icon: Shield },
            { id: 'terms', label: 'Terms of Service', icon: Scale },
            { id: 'refund', label: 'Refund Policy', icon: RefreshCw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDoc(tab.id as any)}
                className={`px-3.5 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
                  isActive
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1 text-white/80 text-[11px] leading-relaxed custom-scrollbar">
          {/* Important Disclaimers Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 space-y-1.5">
            <div className="font-semibold text-xs flex items-center space-x-1.5">
              <span>⚠️ Important Content & License Disclaimers</span>
            </div>
            <p>
              • <strong>Lyrics may come from third-party sources</strong> (such as LRCLIB, user uploads, or community databases). Astralyr does not claim ownership of lyrics.
            </p>
            <p>
              • <strong>Audius tracks are subject to each artist's license.</strong> All audio streaming and cover art remain the property of their respective creators on the Audius network.
            </p>
          </div>

          {activeDoc === 'eula' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">End User License Agreement (EULA)</h3>
              <p>
                Astralyr grants you a personal, non-exclusive license to use the software on up to two (2) devices per purchased license key.
              </p>
              <h4 className="font-semibold text-white mt-2">14-Day Free Evaluation</h4>
              <p>
                Astralyr Desktop comes with a full 14-day trial of Pro features. After 14 days, you may activate a Pro key or continue using Astralyr indefinitely in standard Free mode.
              </p>
              <h4 className="font-semibold text-white mt-2">Restrictions</h4>
              <p>
                You may not reverse engineer, redistribute, or circumvent license verification checks on desktop modules.
              </p>
            </div>
          )}

          {activeDoc === 'privacy' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Privacy Policy</h3>
              <p>
                Astralyr is built as an offline-first, privacy-respecting audio visualizer. Your music library, playlists, and listening habits are stored entirely on your local machine and never transmitted to our servers.
              </p>
              <h4 className="font-semibold text-white mt-2">License Verification</h4>
              <p>
                When activating a Desktop Pro license, an anonymized device identifier is transmitted to the payment provider (LemonSqueezy or DodoPayments) to enforce the 2-device activation limit. No music metadata is included.
              </p>
              <h4 className="font-semibold text-white mt-2">Zero Tracking</h4>
              <p>
                Astralyr contains no telemetry, user tracking, or advertising SDKs.
              </p>
            </div>
          )}

          {activeDoc === 'terms' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Terms of Service</h3>
              <p>
                By using Astralyr, you agree to these Terms. The Web Edition is provided free under the MIT License. The Desktop Pro edition provides advanced audio visualizer capabilities and perpetual licenses.
              </p>
              <h4 className="font-semibold text-white mt-2">User Responsibility</h4>
              <p>
                Users are solely responsible for ensuring they possess lawful rights to any audio files imported into the visualizer.
              </p>
            </div>
          )}

          {activeDoc === 'refund' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Refund Policy</h3>
              <p>
                We offer a transparent <strong>14-day money-back guarantee</strong> on all Astralyr Desktop Pro purchases. If you are not satisfied for any reason within 14 days of purchase, contact support for a prompt refund.
              </p>
              <h4 className="font-semibold text-white mt-2">Trial Period</h4>
              <p>
                Because Astralyr offers a 14-day full free trial prior to purchase, we encourage all customers to evaluate the visualizer and verify audio hardware compatibility before purchasing.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          <span className="text-[10px] text-white/40">
            For legal inquiries: contact@astralyr.app
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

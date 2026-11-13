import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { DesktopLicenseStatus } from '../licensing/types';
import { BUY_PRO_URL, setEdition } from '../features';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [status, setStatus] = useState<DesktopLicenseStatus | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (window.electronAPI?.license?.getStatus) {
      try {
        const s = await window.electronAPI.license.getStatus();
        setStatus(s);
        setEdition(s.edition);
      } catch (err: any) {
        console.error('Failed to get license status:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLicenseKeyInput(text.trim());
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage('Could not read clipboard. Please paste manually (Ctrl+V).');
    }
  };

  const handleActivate = async () => {
    const trimmed = licenseKeyInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your license key.');
      return;
    }

    setIsActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (window.electronAPI?.license?.activate) {
        const res = await window.electronAPI.license.activate(trimmed, 'offline');
        if (res.success) {
          setStatus(res.status);
          setEdition(res.status.edition);
          setSuccessMessage('Astralyr Pro successfully activated offline!');
          setLicenseKeyInput('');
          if (onShowToast) onShowToast('Astralyr Pro activated offline!');
        } else {
          setErrorMessage(res.error || 'Activation failed. Please check your key.');
        }
      } else {
        setErrorMessage('License activation is only available in Astralyr Desktop.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying license key.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate Astralyr Pro on this device?')) {
      return;
    }

    setIsDeactivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (window.electronAPI?.license?.deactivate) {
        const res = await window.electronAPI.license.deactivate();
        if (res.success) {
          await fetchStatus();
          setSuccessMessage('This device has been deactivated. Switched to Free mode.');
          if (onShowToast) onShowToast('Switched to Free mode.');
        } else {
          setErrorMessage(res.error || 'Deactivation failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deactivating license.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleContinueFree = async () => {
    if (window.electronAPI?.license?.continueFree) {
      try {
        const s = await window.electronAPI.license.continueFree();
        setStatus(s as any);
        setEdition('desktop-free');
        if (onShowToast) onShowToast('Continuing in Astralyr Free mode');
        onClose();
      } catch (err: any) {
        console.error('Error continuing in free mode:', err);
      }
    } else {
      setEdition('web');
      onClose();
    }
  };

  const isPro = status?.isPro;
  const isTrial = status?.isTrialActive;
  const trialExpired = status?.trialExpired;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0c0d12] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-white/90">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <Key className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold tracking-wide text-white">Astralyr Desktop Licensing</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* Status Banner */}
          {isPro && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Astralyr Pro Activated</span>
                </div>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  <ShieldCheck className="w-3 h-3" />
                  <span>License verified offline</span>
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                You have lifetime offline access to all Astralyr Pro visual engines, persistent libraries, and fluid themes.
              </p>
              <div className="pt-2 border-t border-emerald-500/20 text-[11px] space-y-1 text-white/70">
                {status?.customerName && (
                  <div>Licensed to: <span className="text-white font-medium">{status.customerName}</span> {status.customerEmail && <span className="text-white/50">({status.customerEmail})</span>}</div>
                )}
                {!status?.customerName && status?.customerEmail && (
                  <div>Licensed to: <span className="text-white font-mono">{status.customerEmail}</span></div>
                )}
                {status?.licenseId && (
                  <div>License ID: <span className="text-white font-mono">{status.licenseId}</span></div>
                )}
                {status?.licenseIssued && (
                  <div>Issued Date: <span className="text-white font-mono">{status.licenseIssued}</span></div>
                )}
                {status?.licenseKeyMasked && (
                  <div>License Key: <span className="text-white font-mono">{status.licenseKeyMasked}</span></div>
                )}
              </div>
            </div>
          )}

          {!isPro && isTrial && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-400 font-semibold text-sm">
                  <Clock className="w-4 h-4" />
                  <span>14-Day Pro Trial Active</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                  {status?.trialDaysRemaining} days remaining
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Enjoy complete access to all Astralyr Desktop Pro visual engines and unlimited persistent playlists during your trial.
              </p>
            </div>
          )}

          {!isPro && trialExpired && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Pro Trial Has Ended</span>
              </div>
              <p className="text-[11px] text-white/70">
                Your 14-day trial has concluded. Enter your offline license key below to unlock Pro, or continue in Free mode. All your local songs and playlists remain 100% accessible.
              </p>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* License Key Activation Section (Shown if not Pro) */}
          {!isPro && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="font-medium text-white flex items-center justify-between">
                <span>Enter Offline License Key</span>
                <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified Offline</span>
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="ASTR-XXXXX-XXXXX-XXXXX-..."
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 text-xs focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                  />
                  <button
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors flex items-center space-x-1"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Paste</span>
                  </button>
                  <button
                    onClick={handleActivate}
                    disabled={isActivating || !licenseKeyInput.trim()}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs transition-colors disabled:opacity-40"
                  >
                    {isActivating ? 'Verifying…' : 'Activate'}
                  </button>
                </div>
                <p className="text-[10px] text-white/50">
                  Keys are issued manually upon purchase. No internet connection or tracking is used.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-white/60">
                <span>Need a license key?</span>
                <a
                  href={BUY_PRO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline flex items-center space-x-1"
                >
                  <span>Buy Astralyr Pro via UPI</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Pro Active Deactivation Option */}
          {isPro && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">Deactivate Pro on This Device</div>
                <div className="text-[11px] text-white/50">Switches back to Free mode and removes the saved key</div>
              </div>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="px-3.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isDeactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          {!isPro && (
            <button
              onClick={handleContinueFree}
              className="text-white/60 hover:text-white text-xs underline-offset-4 hover:underline"
            >
              Continue in Free mode
            </button>
          )}
          <div className="ml-auto flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** The bottom sheet every modal uses. The overlay is padded past the iPhone
 *  status bar so the panel can never slide under the clock/battery, and the
 *  title row with its X stays pinned while the content scrolls. */
export const Sheet: React.FC<Props> = ({ title, subtitle, onClose, children }) => (
  <div
    className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
    onClick={onClose}
  >
    <div
      className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-full sm:max-h-[85vh] flex flex-col border border-zinc-200 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="shrink-0 px-5 pt-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-900">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="p-1.5 -m-1.5 rounded-full text-zinc-400 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        {subtitle && <p className="text-xs text-zinc-500 mb-1">{subtitle}</p>}
      </div>
      <div
        className="overflow-y-auto px-5 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        {children}
      </div>
    </div>
  </div>
);

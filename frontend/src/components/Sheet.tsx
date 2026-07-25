import React from 'react';
import { ChevronLeft, X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void; // shown as a back chevron left of the title
  onClose: () => void;
  children: React.ReactNode;
}

/** The bottom sheet every modal uses. The overlay is padded past the iPhone
 *  status bar so the panel can never slide under the clock/battery, and the
 *  title row with its X stays pinned while the content scrolls. */
export const Sheet: React.FC<Props> = ({ title, subtitle, onBack, onClose, children }) => (
  <div
    className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
    onClick={onClose}
  >
    <div
      className="bg-white w-full sm:max-w-md rounded-t-[20px] sm:rounded-[20px] max-h-full sm:max-h-[85vh] flex flex-col border border-zinc-200 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* iOS grabber — signals the sheet is dismissable */}
      <div className="shrink-0 flex justify-center pt-2.5 pb-1 sm:hidden">
        <span className="w-9 h-1 rounded-full bg-zinc-300" />
      </div>
      <div className="shrink-0 px-5 pt-2 sm:pt-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {onBack && (
              <button aria-label="Back" onClick={onBack} className="icon-btn bg-transparent w-8 h-8 -ml-2 text-zinc-500">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="font-semibold text-zinc-900 truncate">{title}</h3>
          </div>
          <button aria-label="Close" onClick={onClose} className="icon-btn bg-zinc-100 -mr-1 text-zinc-500">
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

import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Collection } from '../types';

interface Props {
  title: string;
  subtitle?: string;
  collections: Collection[];
  selected: number[];
  confirmLabel: string;
  onConfirm: (ids: number[]) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

/** Bottom sheet for choosing one or more collections — used both for
 *  "allocate swipes into…" on the deck and "add to collection" in the library. */
export const CollectionPicker: React.FC<Props> = ({
  title, subtitle, collections, selected, confirmLabel, onConfirm, onCreate, onClose,
}) => {
  const [chosen, setChosen] = useState<number[]>(selected);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const toggle = (id: number) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    await onCreate(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto border border-zinc-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        {subtitle && <p className="text-xs text-zinc-500 mb-3">{subtitle}</p>}

        <div className="space-y-1.5 mb-4">
          {collections.length === 0 && (
            <p className="text-sm text-zinc-400 py-2">No collections yet — create one below.</p>
          )}
          {collections.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                  on ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
                }`}
              >
                <div>
                  <div className="text-sm text-zinc-900">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.counts.liked} selected</div>
                </div>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    on ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mb-5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="New collection — e.g. Basel Paris"
            className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="px-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => onConfirm(chosen)}
          className="w-full bg-zinc-900 text-white font-semibold rounded-full py-3 hover:bg-zinc-700"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Collection } from '../types';

interface Props {
  title: string;
  subtitle?: string;
  collections: Collection[];
  selected: number[];
  confirmLabel: string;
  includeGeneral?: boolean; // show a "General" row that means "no collection"
  onConfirm: (ids: number[]) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}

/** Bottom sheet for choosing one or more collections — used both for
 *  "allocate swipes into…" on the deck and "add to collection" in the library.
 *  Also the home of collection management: rename and delete. */
export const CollectionPicker: React.FC<Props> = ({
  title, subtitle, collections, selected, confirmLabel, includeGeneral, onConfirm, onCreate, onRename, onDelete, onClose,
}) => {
  const [chosen, setChosen] = useState<number[]>(selected);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);

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

  const saveRename = async () => {
    if (renamingId == null || !renameValue.trim()) return;
    await onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  const confirmDelete = async (id: number) => {
    await onDelete(id);
    setChosen((c) => c.filter((x) => x !== id));
    setConfirmingDelete(null);
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
          {includeGeneral && (
            <button
              onClick={() => setChosen([])}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                chosen.length === 0 ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
              }`}
            >
              <div>
                <div className="text-sm text-zinc-900">General</div>
                <div className="text-xs text-zinc-500">No collection — just into your selects</div>
              </div>
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  chosen.length === 0 ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
          {collections.length === 0 && !includeGeneral && (
            <p className="text-sm text-zinc-400 py-2">No collections yet — create one below.</p>
          )}
          {collections.map((c) => {
            const on = chosen.includes(c.id);
            if (confirmingDelete === c.id) {
              return (
                <div key={c.id} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="text-sm text-zinc-900 mb-2">
                    Delete “{c.name}”? The artworks themselves are kept.
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmDelete(c.id)} className="px-3 py-1.5 rounded-full bg-rose-500 text-white text-xs font-semibold">
                      Delete
                    </button>
                    <button onClick={() => setConfirmingDelete(null)} className="px-3 py-1.5 rounded-full bg-white border border-zinc-300 text-zinc-600 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  on ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
                }`}
              >
                {renamingId === c.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                      autoFocus
                      className="flex-1 min-w-0 bg-white border border-zinc-300 rounded-md px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500"
                    />
                    <button onClick={saveRename} className="p-2 rounded-md bg-zinc-900 text-white shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => toggle(c.id)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm text-zinc-900 truncate">{c.name}</div>
                      <div className="text-xs text-zinc-500">{c.counts.liked} selected</div>
                    </button>
                    <button
                      title="Rename"
                      onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete collection"
                      onClick={() => setConfirmingDelete(c.id)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggle(c.id)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        on ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
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

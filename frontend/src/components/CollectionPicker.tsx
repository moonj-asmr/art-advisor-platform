import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import type { Collection } from '../types';
import { Sheet } from './Sheet';
import { SwipeRow } from './SwipeRow';

type SortKey = 'created' | 'name' | 'recent';

const SORTS: Array<[SortKey, string]> = [
  ['created', 'Date created'],
  ['name', 'Name'],
  ['recent', 'Recently added to'],
];

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

interface Props {
  title: string;
  subtitle?: string;
  collections: Collection[];
  selected: number[];
  confirmLabel: string;
  includeGeneral?: boolean; // show a "No collection" row (the default state)
  sortable?: boolean; // show the sort toggle (the manage-collections sheet)
  manageMode?: boolean; // dots select collections for bulk delete instead of picking
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
  title, subtitle, collections, selected, confirmLabel, includeGeneral, sortable, manageMode, onConfirm, onCreate, onRename, onDelete, onClose,
}) => {
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [chosen, setChosen] = useState<number[]>(selected);
  const [sort, setSort] = useState<SortKey>('created');
  const sorted = useMemo(() => {
    const list = [...collections];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'recent')
      list.sort((a, b) =>
        (b.last_added_at ?? b.created_at ?? '').localeCompare(a.last_added_at ?? a.created_at ?? ''));
    else list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return list;
  }, [collections, sort]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
        {sortable && collections.length > 1 && (
          <div className="flex justify-end mb-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent border border-zinc-200 text-zinc-500 text-xs rounded-full px-2.5 py-1.5 focus:outline-none focus:border-blue-900"
            >
              {SORTS.map(([key, label]) => (
                <option key={key} value={key}>Sort: {label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5 mb-4">
          {includeGeneral && (
            <button
              onClick={() => setChosen([])}
              className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                chosen.length === 0 ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'
              }`}
            >
              <div>
                <div className="text-sm text-zinc-900">No collection</div>
                <div className="text-xs text-zinc-500">Right-swipes just go into your Selects</div>
              </div>
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  chosen.length === 0 ? 'bg-blue-900 border-blue-900 text-white' : 'border-zinc-300 text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
          {collections.length === 0 && !includeGeneral && (
            <p className="text-sm text-zinc-400 py-2">No collections yet — create one below.</p>
          )}
          {sorted.map((c) => {
            const on = chosen.includes(c.id);
            const row = (
              <div
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 bg-white ${
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
                      className="field flex-1 min-w-0 px-2.5 py-2 text-sm"
                    />
                    <button onClick={saveRename} className="icon-btn bg-blue-900 text-white hover:text-white shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => toggle(c.id)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm text-zinc-900 truncate">{c.name}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        Created {formatDate(c.created_at)} · {c.counts.liked} select{c.counts.liked === 1 ? '' : 's'}
                      </div>
                    </button>
                    {/* deletion goes through the dots + Delete button, always
                        with confirmation — no per-row trash to fat-finger */}
                    <button
                      title="Rename"
                      onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }}
                      className="icon-btn bg-transparent mr-1 text-zinc-400"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggle(c.id)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        on ? 'bg-blue-900 border-blue-900 text-white' : 'border-zinc-300 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
            // in the manage sheet a row can also be swiped left to delete it,
            // like the PDF rows in the Inbox
            return manageMode ? (
              <SwipeRow
                key={c.id}
                onDelete={async () => {
                  await onDelete(c.id);
                  setChosen((ids) => ids.filter((x) => x !== c.id));
                }}
              >
                {row}
              </SwipeRow>
            ) : (
              <React.Fragment key={c.id}>{row}</React.Fragment>
            );
          })}
        </div>

        <div className="flex gap-2 mb-5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="New collection — e.g. Basel Paris"
            className="field flex-1 px-3 py-2.5 text-sm"
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="btn-quiet px-4"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* bulk delete — manage mode only: dots select, this enacts */}
        {manageMode && chosen.length > 0 && (
          confirmingBulk ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 mb-3">
              <div className="text-sm text-zinc-900 mb-2">
                Delete {chosen.length} collection{chosen.length === 1 ? '' : 's'}? The artworks themselves are kept.
              </div>
              <div className="flex gap-2">
                <button
                  disabled={bulkDeleting}
                  onClick={async () => {
                    setBulkDeleting(true);
                    for (const id of chosen) await onDelete(id);
                    setChosen([]);
                    setBulkDeleting(false);
                    setConfirmingBulk(false);
                  }}
                  className="btn-danger px-3.5 py-2 text-xs"
                >
                  {bulkDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setConfirmingBulk(false)} className="btn-quiet bg-white px-3.5 py-2 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingBulk(true)}
              className="btn-danger w-full text-sm py-3 mb-3"
            >
              Delete {chosen.length} collection{chosen.length === 1 ? '' : 's'}
            </button>
          )
        )}

        <button
          onClick={() => onConfirm(chosen)}
          className="btn-primary w-full py-3.5"
        >
          {confirmLabel}
        </button>
    </Sheet>
  );
};

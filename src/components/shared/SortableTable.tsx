import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;
export interface SortConfig { key: string | null; direction: SortDirection }
type Accessor<T> = (row: T) => unknown;

const isNil = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function useSort<T>(initial?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(initial ?? { key: null, direction: null });
  const handleSort = useCallback((key: string) => {
    setSortConfig((p) => (p.key !== key ? { key, direction: 'asc' } : p.direction === 'asc' ? { key, direction: 'desc' } : { key: null, direction: null }));
  }, []);
  const sortedData = useCallback(
    (data: T[], accessors?: Record<string, Accessor<T>>): T[] => {
      const { key, direction } = sortConfig;
      if (!key || !direction) return data;
      const acc: Accessor<T> = accessors?.[key] ?? ((r: T) => (r as unknown as Record<string, unknown>)[key]);
      return [...data].sort((x, y) => {
        const a = acc(x); const b = acc(y);
        const an = isNil(a); const bn = isNil(b);
        if (an || bn) return an && bn ? 0 : an ? 1 : -1;
        const r = compare(a, b);
        return direction === 'asc' ? r : -r;
      });
    },
    [sortConfig],
  );
  return { sortConfig, handleSort, sortedData };
}

export function SortableHeader({ label, sortKey, sortConfig, onSort, className = '' }: {
  label: ReactNode; sortKey: string; sortConfig: SortConfig; onSort: (k: string) => void; className?: string;
}) {
  const active = sortConfig.key === sortKey;
  return (
    <th className={`px-3 py-2.5 text-start font-semibold ${className}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="group inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-sl-text">
        <span>{label}</span>
        <span className="flex flex-col -space-y-1.5">
          <ChevronUp className={`size-3.5 ${active && sortConfig.direction === 'asc' ? 'text-blue-500' : 'opacity-30 group-hover:opacity-60'}`} strokeWidth={3} />
          <ChevronDown className={`size-3.5 ${active && sortConfig.direction === 'desc' ? 'text-blue-500' : 'opacity-30 group-hover:opacity-60'}`} strokeWidth={3} />
        </span>
      </button>
    </th>
  );
}

export interface Column<T> {
  key: string; label: ReactNode; render?: (row: T) => ReactNode; sortValue?: Accessor<T>; sortable?: boolean; className?: string; headerClassName?: string;
}

export function DataTable<T>({ columns, data, rowKey, onRowClick, empty, initialSort, minWidth = 720, rowClassName }: {
  columns: Column<T>[]; data: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; empty?: ReactNode;
  initialSort?: SortConfig; minWidth?: number; rowClassName?: (r: T) => string;
}) {
  const { sortConfig, handleSort, sortedData } = useSort<T>(initialSort);
  const accessors = useMemo(() => {
    const out: Record<string, Accessor<T>> = {};
    for (const c of columns) if (c.sortValue) out[c.key] = c.sortValue;
    return out;
  }, [columns]);
  const rows = sortedData(data, accessors);
  return (
    <div className="overflow-hidden rounded-xl border border-sl-border bg-sl-card shadow-sm animate-slide-up">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="bg-sl-card2 text-[11px] text-sl-muted">
            <tr>
              {columns.map((c) =>
                c.sortable === false ? (
                  <th key={c.key} className={`px-3 py-2.5 text-start font-semibold uppercase tracking-wide ${c.headerClassName ?? ''}`}>{c.label}</th>
                ) : (
                  <SortableHeader key={c.key} label={c.label} sortKey={c.key} sortConfig={sortConfig} onSort={handleSort} className={c.headerClassName} />
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-t border-sl-border hover:bg-sl-hover ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(r) ?? ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-middle ${c.className ?? ''}`}>
                    {c.render ? c.render(r) : String((r as unknown as Record<string, unknown>)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && empty}
    </div>
  );
}
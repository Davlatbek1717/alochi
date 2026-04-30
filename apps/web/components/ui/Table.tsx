'use client';
import { ReactNode, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
  loading?: boolean;
  rowAction?: (row: T) => void;
  className?: string;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = "Ma'lumot yo'q",
  loading,
  rowAction,
  className = '',
}: Props<T>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortBy) return data;
    const col = columns.find((c) => c.key === sortBy);
    if (!col) return data;
    const accessor =
      col.accessor ??
      ((row: T) => {
        const v = row[col.key as keyof T];
        return typeof v === 'string' || typeof v === 'number' ? v : String(v);
      });
    return [...data].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortBy, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-3 space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-700/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/40 sticky top-0">
            <tr className="border-b border-slate-700">
              {columns.map((col) => {
                const align = col.align ?? 'left';
                const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                return (
                  <th
                    key={String(col.key)}
                    className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${alignCls}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => toggleSort(String(col.key))}
                        className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {col.label}
                        {sortBy === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={String(row[keyField])}
                onClick={rowAction ? () => rowAction(row) : undefined}
                className={`border-b border-slate-700/50 last:border-0 transition-colors ${
                  idx % 2 === 1 ? 'bg-slate-900/20' : ''
                } ${rowAction ? 'cursor-pointer hover:bg-slate-700/40' : 'hover:bg-slate-700/20'}`}
              >
                {columns.map((col) => {
                  const align = col.align ?? 'left';
                  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                  const content = col.render ? col.render(row) : (row[col.key as keyof T] as ReactNode);
                  return (
                    <td key={String(col.key)} className={`px-4 py-3 text-slate-300 ${alignCls}`}>
                      {content as ReactNode}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

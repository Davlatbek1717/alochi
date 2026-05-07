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
  rowClassName?: (row: T) => string;
  className?: string;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = "Ma'lumot yo'q",
  loading,
  rowAction,
  rowClassName,
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
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-[var(--shadow-1)]">
        <div className="p-4 space-y-2.5 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-11 bg-[var(--surface-3)] rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={[
          'bg-[var(--surface)]',
          'border border-[var(--line)] rounded-2xl',
          'p-14 text-center',
          'text-[var(--ink-3)] text-sm',
          'shadow-[var(--shadow-1)]',
        ].join(' ')}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={[
        'bg-[var(--surface)] rounded-2xl overflow-hidden',
        'border border-[var(--line)]',
        'shadow-[var(--shadow-1)]',
        className,
      ].join(' ')}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] sticky top-0">
            <tr className="border-b border-[var(--line)]">
              {columns.map((col) => {
                const align = col.align ?? 'left';
                const alignCls =
                  align === 'center'
                    ? 'text-center'
                    : align === 'right'
                      ? 'text-right'
                      : 'text-left';
                return (
                  <th
                    key={String(col.key)}
                    scope="col"
                    className={[
                      'px-5 py-3.5',
                      'text-[10px] font-extrabold uppercase tracking-[0.16em]',
                      'text-[var(--ink-3)]',
                      alignCls,
                    ].join(' ')}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => toggleSort(String(col.key))}
                        className="inline-flex items-center gap-1.5 hover:text-[var(--brand)] transition-colors"
                      >
                        {col.label}
                        {sortBy === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={12} strokeWidth={2.5} />
                          ) : (
                            <ArrowDown size={12} strokeWidth={2.5} />
                          )
                        ) : (
                          <ArrowUpDown
                            size={12}
                            strokeWidth={2.5}
                            className="opacity-40"
                          />
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
                className={[
                  'border-b border-[var(--line)]/70 last:border-0',
                  'transition-colors duration-100',
                  idx % 2 === 1 ? 'bg-[var(--surface-2)]/40' : '',
                  rowAction
                    ? 'cursor-pointer hover:bg-[var(--brand-soft)]/40'
                    : 'hover:bg-[var(--surface-2)]/60',
                  rowClassName ? rowClassName(row) : '',
                ].join(' ')}
              >
                {columns.map((col) => {
                  const align = col.align ?? 'left';
                  const alignCls =
                    align === 'center'
                      ? 'text-center'
                      : align === 'right'
                        ? 'text-right'
                        : 'text-left';
                  const content = col.render
                    ? col.render(row)
                    : (row[col.key as keyof T] as ReactNode);
                  return (
                    <td
                      key={String(col.key)}
                      className={[
                        'px-5 py-3.5 text-[var(--ink)]',
                        alignCls,
                      ].join(' ')}
                    >
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

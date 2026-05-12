"use client";

import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  emptyMessage = "No data",
  loading,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-3">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider whitespace-nowrap ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-bg-3 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            : data.length === 0
            ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-text-3 text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
            : data.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border/50 last:border-0 transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-bg-3/50" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-text-2 ${col.className ?? ""}`}
                    >
                      {col.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

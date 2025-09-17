import React from "react";

export type SortKey =
  | "top_earners"
  | "time_newest"
  | "time_oldest"
  | "name_asc"
  | "name_desc"
  | "most_sessions"
  | "most_upcoming";

export interface StudentFiltersProps {
  sortKey: SortKey;
  onSortKeyChange: (v: SortKey) => void;
  query: string;
  onQueryChange: (v: string) => void;
  onReset: () => void;
}

export default function StudentFilters({
  sortKey, onSortKeyChange,
  query, onQueryChange,
  onReset,
}: StudentFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-gray-500 mb-1">Sort by</label>
          <select
            value={sortKey}
            onChange={(e) => onSortKeyChange(e.target.value as any)}
            className="border rounded-md px-3 py-2"
          >
            <option value="top_earners">Top earners (desc)</option>
            <option value="time_newest">Time added (newest)</option>
            <option value="time_oldest">Time added (oldest)</option>
            <option value="most_sessions">Most sessions</option>
            <option value="most_upcoming">Most upcoming</option>
            <option value="name_asc">Name A→Z</option>
            <option value="name_desc">Name Z→A</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-gray-500 mb-1">Search name</label>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Type to filter…"
            className="border rounded-md px-3 py-2 w-56"
          />
        </div>
      </div>

      <button
        onClick={onReset}
        className="self-start md:self-auto border px-3 py-2 rounded-md hover:bg-gray-50"
        type="button"
      >
        Reset
      </button>
    </div>
  );
}
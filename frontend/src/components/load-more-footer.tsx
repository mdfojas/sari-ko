'use client';

interface LoadMoreFooterProps {
  shown: number;
  total: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (size: number) => void;
  onLoadMore: () => void;
}

// "Showing X of Y", a results-per-load chooser and a Load button. Shared by the
// Products and Store Prices lists so both page the same way.
export function LoadMoreFooter({ shown, total, pageSize, pageSizeOptions, onPageSizeChange, onLoadMore }: LoadMoreFooterProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border p-3 text-sm text-text-muted">
      <span>
        Showing {shown} of {total}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Results per load
          <select
            aria-label="Results per load"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-card px-2 py-1 text-text"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {total > shown && (
          <button type="button" onClick={onLoadMore} className="font-semibold text-accent-dark">
            Load {Math.min(pageSize, total - shown)} more
          </button>
        )}
      </div>
    </div>
  );
}

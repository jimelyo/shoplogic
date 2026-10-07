export type SkeletonType = 'text' | 'card' | 'table' | 'avatar' | 'image';

export function Skeleton({ type = 'text', className = '', lines = 3, rows = 5 }: { type?: SkeletonType; className?: string; lines?: number; rows?: number }) {
  switch (type) {
    case 'avatar':
      return <div className={`sl-skeleton size-10 rounded-full ${className}`} />;
    case 'image':
      return <div className={`sl-skeleton h-40 w-full rounded-xl ${className}`} />;
    case 'card':
      return (
        <div className={`rounded-xl border border-sl-border bg-sl-card p-4 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="sl-skeleton size-10 rounded-lg" />
            <div className="flex-1 space-y-2"><div className="sl-skeleton h-3 w-2/3 rounded" /><div className="sl-skeleton h-5 w-1/2 rounded" /></div>
          </div>
        </div>
      );
    case 'table':
      return (
        <div className={`overflow-hidden rounded-xl border border-sl-border bg-sl-card ${className}`}>
          <div className="sl-skeleton h-10 w-full" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 border-t border-sl-border px-4 py-3">
              <div className="sl-skeleton h-3 flex-[2] rounded" /><div className="sl-skeleton h-3 flex-1 rounded" /><div className="sl-skeleton h-3 flex-1 rounded" />
            </div>
          ))}
        </div>
      );
    default:
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: lines }).map((_, i) => <div key={i} className="sl-skeleton h-3 rounded" style={{ width: `${100 - i * 15}%` }} />)}
        </div>
      );
  }
}

export function LoadingPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} type="card" />)}
      </div>
      <Skeleton type="table" rows={6} />
    </div>
  );
}
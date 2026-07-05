import { Bone } from "@/components/loading/skeletons";

export default function CalendarLoading() {
  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-pulse">
      {/* Header: title + actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Bone className="h-7 w-7 rounded" />
            <Bone className="h-9 w-52 rounded-lg" />
          </div>
          <Bone className="h-4 w-72 bg-muted/70" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-9 w-36 rounded-lg" />
          <Bone className="h-9 w-56 rounded-lg" />
        </div>
      </div>

      {/* Timeline card */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <Bone className="h-3 w-40 bg-muted/70" />
          <Bone className="h-3 w-28 bg-muted/60" />
        </div>
        {/* Column header row */}
        <div className="flex border-b border-border">
          <div className="shrink-0 border-r border-border p-3" style={{ width: 220 }}>
            <Bone className="h-3 w-24 bg-muted/70" />
          </div>
          <div className="flex">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="shrink-0 border-r border-border flex flex-col items-center justify-center gap-1 py-2" style={{ width: 52 }}>
                <Bone className="h-2 w-6 bg-muted/50" />
                <Bone className="h-3 w-4" />
              </div>
            ))}
          </div>
        </div>
        {/* Room section header */}
        <div className="flex bg-muted/60 border-b border-border">
          <div className="px-4 py-2 flex items-center gap-2" style={{ width: 220 }}>
            <Bone className="h-3.5 w-3.5 rounded" />
            <Bone className="h-3 w-20" />
            <Bone className="ml-auto h-4 w-12 rounded-full" />
          </div>
        </div>
        {/* Bed rows */}
        {Array.from({ length: 3 }).map((_, r) => (
          <div key={r} className="flex border-b border-border last:border-0" style={{ height: 56 }}>
            <div className="shrink-0 border-r border-border flex items-center px-4" style={{ width: 220 }}>
              <Bone className="h-3 w-16" />
            </div>
            <div className="relative flex-1 flex">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="shrink-0 border-r border-border/60" style={{ width: 52 }} />
              ))}
              {r === 0 && <div className="absolute top-2 bottom-2 rounded-md bg-muted" style={{ left: 54 * 4, width: 52 * 4 }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Shared skeleton primitives so each route's loading.tsx can compose a shape
// that matches its real content. All bones use bg-muted on the botanical surface.
import { cn } from "@/lib/utils";

export function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded bg-muted", className)} />;
}

export function PageHeaderSkel({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-3">
        <Bone className="h-9 w-56 rounded-lg" />
        <Bone className="h-4 w-40 bg-muted/70" />
      </div>
      {withActions && <Bone className="h-9 w-32 rounded-xl" />}
    </div>
  );
}

export function StatCardsSkel({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Bone className="h-3 w-24 bg-muted/70" />
            <Bone className="h-8 w-20" />
            <Bone className="h-3 w-16 bg-muted/60" />
          </div>
          <Bone className="h-11 w-11 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function SearchBarSkel() {
  return <Bone className="h-10 w-full rounded-xl" />;
}

export function FiltersRowSkel({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3 w-20 bg-muted/60" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function TableSkel({
  rows = 6,
  avatar = false,
  action = false,
}: { rows?: number; avatar?: boolean; action?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
      <div className="h-11 bg-muted/40 border-b border-border" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0">
          {avatar && <Bone className="h-9 w-9 rounded-full shrink-0" />}
          <Bone className="h-4 flex-1 max-w-[180px] bg-muted/70" />
          <Bone className="h-4 w-24 bg-muted/60" />
          <Bone className="h-4 w-24 bg-muted/60 hidden sm:block" />
          <Bone className="h-4 w-20 bg-muted/60 hidden md:block" />
          {action && <Bone className="h-8 w-20 rounded-lg ml-auto" />}
        </div>
      ))}
    </div>
  );
}

export function ChartGridSkel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg border border-border bg-surface p-6 space-y-4",
            i >= 2 && "lg:col-span-2"
          )}
        >
          <div className="flex items-center gap-2">
            <Bone className="h-5 w-5 rounded" />
            <Bone className="h-5 w-40" />
          </div>
          <Bone className="h-[240px] w-full rounded-lg bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

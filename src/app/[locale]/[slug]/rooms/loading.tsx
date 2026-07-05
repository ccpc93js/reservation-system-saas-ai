import { Bone, PageHeaderSkel } from "@/components/loading/skeletons";

export default function RoomsLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <PageHeaderSkel />
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className="space-y-4">
          <Bone className="h-6 w-40" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <Bone className="h-5 w-32" />
                <Bone className="h-4 w-24 bg-muted/70" />
                <div className="flex gap-2 pt-2">
                  <Bone className="h-8 w-8 rounded-lg" />
                  <Bone className="h-8 w-8 rounded-lg" />
                  <Bone className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

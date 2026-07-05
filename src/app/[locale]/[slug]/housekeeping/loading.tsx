import { Bone, PageHeaderSkel } from "@/components/loading/skeletons";

export default function HousekeepingLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <PageHeaderSkel />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Bone className="h-5 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-2">
                  <Bone className="h-4 w-20" />
                  <Bone className="h-3 w-14 bg-muted/60" />
                </div>
                <Bone className="h-7 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

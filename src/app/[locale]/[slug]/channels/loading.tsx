import { Bone, PageHeaderSkel } from "@/components/loading/skeletons";

export default function ChannelsLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <PageHeaderSkel />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Bone className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Bone className="h-4 w-28" />
                <Bone className="h-3 w-20 bg-muted/60" />
              </div>
            </div>
            <Bone className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

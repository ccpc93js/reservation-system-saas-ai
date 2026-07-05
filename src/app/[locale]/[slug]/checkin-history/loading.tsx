import { PageHeaderSkel, SearchBarSkel, TableSkel } from "@/components/loading/skeletons";

export default function GuestBookLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <PageHeaderSkel />
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-sm"><SearchBarSkel /></div>
        <div className="h-9 w-24 rounded-xl bg-muted shrink-0" />
      </div>
      <TableSkel rows={6} />
    </div>
  );
}

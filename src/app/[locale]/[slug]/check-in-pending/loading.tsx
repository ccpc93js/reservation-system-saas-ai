import { PageHeaderSkel, TableSkel } from "@/components/loading/skeletons";

export default function PendingCheckInsLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8">
        <PageHeaderSkel />
        <TableSkel rows={4} avatar action />
      </div>
    </div>
  );
}

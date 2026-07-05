// Generic fallback skeleton — used for any section without its own loading.tsx.
import { PageHeaderSkel, StatCardsSkel, TableSkel } from "@/components/loading/skeletons";

export default function TenantSectionLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <PageHeaderSkel />
      <StatCardsSkel />
      <TableSkel rows={6} avatar action />
    </div>
  );
}

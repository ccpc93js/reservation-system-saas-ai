import { PageHeaderSkel, StatCardsSkel, TableSkel } from "@/components/loading/skeletons";

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-10 animate-pulse">
      <PageHeaderSkel withActions={false} />
      <StatCardsSkel count={4} />
      <TableSkel rows={5} avatar action />
    </div>
  );
}

import { PageHeaderSkel, StatCardsSkel, ChartGridSkel } from "@/components/loading/skeletons";

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-8 animate-pulse">
      <PageHeaderSkel />
      <StatCardsSkel count={4} />
      <ChartGridSkel />
    </div>
  );
}

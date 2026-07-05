import { PageHeaderSkel, SearchBarSkel, FiltersRowSkel, TableSkel } from "@/components/loading/skeletons";

export default function ReservationsLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <PageHeaderSkel />
      <SearchBarSkel />
      <FiltersRowSkel count={3} />
      <TableSkel rows={8} />
    </div>
  );
}

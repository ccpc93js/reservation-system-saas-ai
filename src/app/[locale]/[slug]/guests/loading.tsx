import { PageHeaderSkel, SearchBarSkel, TableSkel } from "@/components/loading/skeletons";

export default function GuestsLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <PageHeaderSkel />
      <SearchBarSkel />
      <TableSkel rows={8} avatar action />
    </div>
  );
}

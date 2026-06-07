export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="hover:bg-muted/40">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-3">
          <div className="h-4 bg-muted rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

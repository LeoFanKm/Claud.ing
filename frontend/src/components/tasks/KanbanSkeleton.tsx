import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TaskCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-1 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  );
}

interface KanbanColumnSkeletonProps {
  cardCount?: number;
  className?: string;
}

function KanbanColumnSkeleton({
  cardCount = 3,
  className,
}: KanbanColumnSkeletonProps) {
  return (
    <div className={cn("flex min-w-[280px] flex-col gap-2", className)}>
      <div className="mb-2 flex items-center gap-2 px-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: cardCount }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

interface KanbanSkeletonProps {
  columns?: number;
  cardsPerColumn?: number[];
  className?: string;
}

export function KanbanSkeleton({
  columns = 5,
  cardsPerColumn = [2, 3, 1, 2, 0],
  className,
}: KanbanSkeletonProps) {
  return (
    <div
      className={cn(
        "fade-in flex animate-in gap-4 overflow-x-auto p-4 duration-300",
        className
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <KanbanColumnSkeleton cardCount={cardsPerColumn[i] ?? 2} key={i} />
      ))}
    </div>
  );
}

export { TaskCardSkeleton, KanbanColumnSkeleton };

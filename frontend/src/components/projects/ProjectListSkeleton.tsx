import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProjectCardSkeletonProps {
  className?: string;
}

function ProjectCardSkeleton({ className }: ProjectCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5 transition-colors",
        className
      )}
    >
      {/* Header with icon and menu */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="mb-1 h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

interface ProjectListSkeletonProps {
  count?: number;
  className?: string;
}

export function ProjectListSkeleton({
  count = 6,
  className,
}: ProjectListSkeletonProps) {
  return (
    <div className={cn("h-full space-y-6 overflow-auto p-8 pb-16 md:pb-8", className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-9 w-32" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Grid of project card skeletons */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export { ProjectCardSkeleton };

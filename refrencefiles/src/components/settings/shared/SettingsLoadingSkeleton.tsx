import { Skeleton } from '@/components/ui/skeleton';

interface SettingsLoadingSkeletonProps {
  rows?: number;
}

const SettingsLoadingSkeleton = ({ rows = 2 }: SettingsLoadingSkeletonProps) => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-4 mt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
};

export default SettingsLoadingSkeleton;

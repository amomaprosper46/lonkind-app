
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PostCardSkeleton from './post-card-skeleton';

export default function ProfileViewSkeleton() {
  return (
    <div className="w-full">
      <Card className="mb-6 overflow-hidden">
        <Skeleton className="h-48 w-full" />
        <CardContent className="flex flex-col md:flex-row items-center gap-6 p-6 pt-0">
          <Skeleton className="w-32 h-32 rounded-full -mt-16 border-4 border-background" />
          <div className="flex-1 text-center md:text-left space-y-3">
            <Skeleton className="h-8 w-48 mx-auto md:mx-0" />
            <Skeleton className="h-6 w-24 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-full max-w-sm mx-auto md:mx-0" />
            <Skeleton className="h-4 w-3/4 max-w-xs mx-auto md:mx-0" />
            <div className="flex justify-center md:justify-start gap-6 mt-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="flex gap-2 self-start md:self-auto">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-4 border-b">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-6 pt-4">
            <PostCardSkeleton />
        </div>
      </div>
    </div>
  );
}

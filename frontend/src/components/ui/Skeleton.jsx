import { cn } from '@/lib/utils';

// Loading placeholder for skeleton states in ControlPanel/Status/Memory.
export const Skeleton = ({ className, ...props }) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-xl bg-[var(--card)]', className)}
    {...props}
  />
);

export default Skeleton;

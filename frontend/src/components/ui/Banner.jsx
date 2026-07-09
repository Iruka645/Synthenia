import { cn } from '@/lib/utils';

// Theme-aware alert/status banner. Replaces the repeated green/red toast
// inline-style blocks scattered across the control-panel tabs.
const VARIANTS = {
  success: 'bg-green-500/10 border-green-500/25 text-green-700 dark:text-green-300',
  error: 'bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-300',
  info: 'bg-[var(--accent-bg)] border-[var(--accent-border)] text-[var(--accent)]',
};

export const Banner = ({ type = 'info', icon, children, className }) => {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-3 text-[13px] leading-relaxed',
        VARIANTS[type] || VARIANTS.info,
        className,
      )}
    >
      {icon && <span aria-hidden="true" className="leading-none">{icon}</span>}
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default Banner;

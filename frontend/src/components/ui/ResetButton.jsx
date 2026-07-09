import { cn } from '@/lib/utils';

// Borderless accent-colored link button used for "reset to default" actions
// across config tabs. Replaces the repeated inline-styled reset buttons.
export const ResetButton = ({ children, className, ...props }) => (
  <button
    type="button"
    className={cn(
      'bg-transparent border-0 text-[var(--accent)] text-[11px] font-semibold p-0 cursor-pointer hover:underline',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export default ResetButton;

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes safely (later classes win, conflicts resolved).
 */
export const cn = (...inputs) => twMerge(clsx(inputs));

import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge shadcn utility classes while preserving semantic token variants. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

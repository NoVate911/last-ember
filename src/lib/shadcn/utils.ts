import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Register the theme's spacing keys so `p-density-lg` replaces `p-density-md` instead of both being kept.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["density-xs", "density-sm", "density-md", "density-lg", "density-xl"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
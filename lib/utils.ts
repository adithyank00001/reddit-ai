import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a Unix timestamp (seconds since epoch) to a relative time string
 * Examples: "2h ago", "5m ago", "3d ago", "just now"
 */
export function formatRelativeTime(created_utc: number): string {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const diff = now - created_utc; // Difference in seconds

  if (diff < 60) {
    return "just now";
  }

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(diff / 3600);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(diff / 86400);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

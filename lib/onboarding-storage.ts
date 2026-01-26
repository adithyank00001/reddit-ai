/**
 * Utility functions for managing onboarding data in localStorage
 * This allows users to navigate back and forth without losing their data
 * Data is only saved to database when onboarding is fully complete
 */

const STORAGE_KEY = "onboarding_data";

export interface OnboardingData {
  websiteUrl?: string;
  productDescription?: string;
  keywords?: string[];
  subreddits?: string[];
}

/**
 * Get onboarding data from localStorage
 */
export function getOnboardingData(): OnboardingData {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading onboarding data from localStorage:", error);
  }

  return {};
}

/**
 * Save onboarding data to localStorage
 */
export function saveOnboardingData(data: Partial<OnboardingData>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const existing = getOnboardingData();
    const updated = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving onboarding data to localStorage:", error);
  }
}

/**
 * Clear onboarding data from localStorage
 */
export function clearOnboardingData(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing onboarding data from localStorage:", error);
  }
}

/**
 * Get all onboarding data (for final save)
 */
export function getAllOnboardingData(): OnboardingData {
  return getOnboardingData();
}

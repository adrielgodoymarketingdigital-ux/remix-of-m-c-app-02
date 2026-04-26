import { useEffect } from "react";
import { useTutorial } from "./TutorialContext";

/**
 * Auto-starts tutorial for first-time users after onboarding.
 * Shows once, on dashboard mount, if tutorial hasn't been completed.
 */
export function TutorialAutoStart() {
  const { hasCompletedTutorial, startTutorial, isActive } = useTutorial();

  useEffect(() => {
    if (!hasCompletedTutorial && !isActive) {
      // Small delay to let the dashboard render first
      const timeout = setTimeout(() => {
        startTutorial();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [hasCompletedTutorial, isActive, startTutorial]);

  return null;
}

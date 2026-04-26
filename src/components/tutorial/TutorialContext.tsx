import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { tutorialSteps, TutorialStep } from "./tutorialSteps";

interface TutorialContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  hasCompletedTutorial: boolean;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}

const STORAGE_KEY = "mec_tutorial_completed";

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const currentStep = isActive ? tutorialSteps[currentStepIndex] ?? null : null;

  const startTutorial = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const finish = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
    setHasCompletedTutorial(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      finish();
    }
  }, [currentStepIndex, finish]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  }, [currentStepIndex]);

  const skipTutorial = useCallback(() => {
    finish();
  }, [finish]);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStepIndex,
        currentStep,
        totalSteps: tutorialSteps.length,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        hasCompletedTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

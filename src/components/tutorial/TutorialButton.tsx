import { useTutorial } from "./TutorialContext";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TutorialButton() {
  const { startTutorial, isActive } = useTutorial();

  if (isActive) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={startTutorial}
            size="icon"
            variant="outline"
            className="fixed bottom-[208px] lg:bottom-[134px] right-6 z-40 h-11 w-11 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 border-blue-500 text-white hover:text-white"
          >
            <GraduationCap className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Tutorial do sistema</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

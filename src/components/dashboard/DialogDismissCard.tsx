import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, CalendarDays, Infinity } from "lucide-react";
import { DismissDuration, DISMISS_OPTIONS } from "@/lib/card-dismiss";

interface DialogDismissCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: (duration: DismissDuration) => void;
  title?: string;
}

const ICONS: Record<DismissDuration, React.ReactNode> = {
  forever: <Infinity className="h-4 w-4" />,
  month: <CalendarDays className="h-4 w-4" />,
  week: <Calendar className="h-4 w-4" />,
  hours: <Clock className="h-4 w-4" />,
};

export function DialogDismissCard({ 
  open, 
  onOpenChange, 
  onDismiss,
  title = "Fechar por quanto tempo?"
}: DialogDismissCardProps) {
  const handleDismiss = (duration: DismissDuration) => {
    onDismiss(duration);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Escolha por quanto tempo deseja ocultar este card.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          {DISMISS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className="justify-start h-11"
              onClick={() => handleDismiss(option.value)}
            >
              {ICONS[option.value]}
              <span className="ml-2">{option.label}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

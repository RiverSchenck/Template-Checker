import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Info } from 'lucide-react';
import { triggerConfettiCelebration } from './Confetti';

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  seeDetails?: (value: boolean) => void;
  navigateToResults?: () => void;
}

export default function SuccessModal({
  open,
  onClose,
  seeDetails,
  navigateToResults,
}: SuccessModalProps) {
  useEffect(() => {
    if (open) {
      triggerConfettiCelebration();
    }
  }, [open]);

  const handleSeeDetails = () => {
    seeDetails?.(true);
    navigateToResults?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Template champion</DialogTitle>
          <DialogDescription>
            No errors or warnings detected. Your template passed validation.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <span>Unchecked issues are still possible. Review results for full context.</span>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {seeDetails && (
            <Button variant="outline" onClick={handleSeeDetails}>
              See details
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

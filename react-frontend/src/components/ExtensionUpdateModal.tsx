import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle, Download } from 'lucide-react';

interface ExtensionUpdateModalProps {
  open: boolean;
  onClose: () => void;
  installedVersion: string;
  latestVersion: string;
  onGoToExtension: () => void;
}

/**
 * Modal shown when the user's Template Checker extension is out of date.
 * More visible than a toast so users don't miss the update prompt.
 */
export default function ExtensionUpdateModal({
  open,
  onClose,
  installedVersion,
  latestVersion,
  onGoToExtension,
}: ExtensionUpdateModalProps) {
  const handleGoToExtension = () => {
    onGoToExtension();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md border-2 border-amber-500/40 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            Extension update available
          </DialogTitle>
          <DialogDescription className="text-left text-amber-900/90 dark:text-amber-100/90">
            Your Template Checker extension is out of date. For the best experience and latest fixes,
            please update to the newest version.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            You have {installedVersion === 'unknown' ? 'an older extension (version unknown)' : `v${installedVersion}`} · Latest is v{latestVersion}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Remind me later
          </Button>
          <Button onClick={handleGoToExtension} className="gap-2">
            <Download className="h-4 w-4" aria-hidden />
            Go to Extension page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

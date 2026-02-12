import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

interface FileSizeErrorModalProps {
  open: boolean;
  onClose: () => void;
  fileSizeMB: string;
  maxSizeMB: number;
}

export default function FileSizeErrorModal({
  open,
  onClose,
  fileSizeMB,
  maxSizeMB,
}: FileSizeErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            File too large
          </DialogTitle>
          <DialogDescription>
            The file you selected exceeds the maximum allowed size.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">File size</dt>
            <dd className="font-medium">{fileSizeMB} MB</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Maximum size</dt>
            <dd className="font-medium">{maxSizeMB} MB</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Tip: Remove large files from the &quot;links&quot; folder and re-zip, then ignore missing image errors if needed.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

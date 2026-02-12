import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import FileUploadPage from '../File Upload/FileUpload';
import { ValidationResult } from '../../types';

interface ReuploadButtonProps {
  checkerResponse: (jsonResponse: ValidationResult) => void;
  className?: string;
}

export default function ReuploadButton({ checkerResponse, className }: ReuploadButtonProps) {
  const [open, setOpen] = useState(false);

  const handleUploadComplete = () => {
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        Reupload and compare
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload new file</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <FileUploadPage
              checkerResponse={checkerResponse}
              setPrevious={true}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

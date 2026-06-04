"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextInputDialog({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  defaultValue = "",
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState(defaultValue);

  // Reset the field to the provided default each time the dialog opens.
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return;
            onSubmit(trimmed);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>{label}</Label>
            <Input
              id={fieldId}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm">
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="mt-1.5 text-[13px] text-[var(--text-3)]">
            {description}
          </DialogDescription>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

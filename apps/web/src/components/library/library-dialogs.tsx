"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  /** Accessible name for the field; falls back to the placeholder. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const fieldId = useId();

  // Uncontrolled on purpose: the dialog content unmounts when closed, so each
  // open remounts the input fresh with the current defaultValue.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        <form
          className="mt-3 space-y-4"
          action={(formData) => {
            const value = String(formData.get("value") ?? "").trim();
            if (!value) return;
            onSubmit(value);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <Input
              id={fieldId}
              name="value"
              aria-label={label ?? placeholder}
              defaultValue={defaultValue}
              placeholder={placeholder}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectDialogForm({
  fieldId,
  label,
  options,
  defaultValue,
  submitLabel,
  submitDisabledValues,
  onOpenChange,
  onSubmit,
}: {
  fieldId: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  submitLabel: string;
  submitDisabledValues: readonly string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      className="mt-3 space-y-4"
      action={(formData) => {
        onSubmit(String(formData.get("value") ?? ""));
        onOpenChange(false);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        <Select
          id={fieldId}
          name="value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          size="sm"
          disabled={!value || submitDisabledValues.includes(value)}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SelectDialog({
  open,
  onOpenChange,
  title,
  label,
  options,
  defaultValue = "",
  submitLabel,
  submitDisabledValues = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  submitLabel: string;
  submitDisabledValues?: readonly string[];
  onSubmit: (value: string) => void;
}) {
  const fieldId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        <SelectDialogForm
          fieldId={fieldId}
          label={label}
          options={options}
          defaultValue={defaultValue}
          submitLabel={submitLabel}
          submitDisabledValues={submitDisabledValues}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
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
          <DialogDescription className="mt-1.5 text-[13px] text-text-3">
            {description}
          </DialogDescription>
        ) : null}
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsKeyForm({ initialKeySet }: { initialKeySet: boolean }) {
  const [keySet, setKeySet] = useState(initialKeySet);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/assistant/key", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: value }),
    });
    if (res.ok) {
      setKeySet(true);
      setValue("");
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  async function remove() {
    setStatus("saving");
    const res = await fetch("/api/assistant/key", { method: "DELETE" });
    if (res.ok) {
      setKeySet(false);
      setValue("");
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {keySet ? (
        <p className="text-sm text-emerald-600">A key is set.</p>
      ) : (
        <p className="text-sm text-amber-600">
          No key set — the assistant is disabled.
        </p>
      )}
      <Input
        type="password"
        aria-label="Claude API key"
        placeholder="sk-ant-..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button
          onClick={save}
          disabled={value.trim().length === 0 || status === "saving"}
        >
          {keySet ? "Replace key" : "Save key"}
        </Button>
        {keySet ? (
          <Button
            variant="outline"
            onClick={remove}
            disabled={status === "saving"}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {status === "saved" ? (
        <p className="text-sm text-muted-foreground">Saved.</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-destructive">Could not save the key.</p>
      ) : null}
    </div>
  );
}

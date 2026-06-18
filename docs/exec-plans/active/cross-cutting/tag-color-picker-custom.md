# Custom Tag Color Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tag color native select with a custom color-block picker and align the create-tag controls on desktop.

**Architecture:** Keep `TagColorPicker` as the form field boundary: it owns color selection, emits the selected hex through `onChange`, and submits through a hidden named input. The picker renders the selected color as the row prompt and opens a compact color-block menu for preset choices. Update `TagPanel` only for the create-tag row layout so the picker, tag name input, and submit button line up on desktop and wrap cleanly on mobile.

**Tech Stack:** React 19 client components, Testing Library + Vitest, Tailwind v4 utilities, existing shadcn-style `Button` and `Input` components.

## Global Constraints

- Preserve tag color values as strings stored via the existing `color` form field.
- Keep `TAG_COLOR_PRESETS` as the single source of color labels and hex values.
- Desktop create-tag form order is color picker, tag name input, submit button.
- Mobile layout may wrap, but controls must remain usable without overflow.
- Do not touch service, database, or API boundaries.
- Run `bun run check` after the patch.

---

### Task 1: Custom picker behavior and create row layout

**Files:**
- Modify: `apps/web/src/components/library/tag-color-picker.tsx`
- Modify: `apps/web/src/components/library/tag-panel.tsx`
- Test: `apps/web/src/components/library/__tests__/tag-color-picker.test.tsx`

**Interfaces:**
- Consumes: `TAG_COLOR_PRESETS: readonly { label: string; value: string }[]`
- Produces: `TagColorPicker({ name, value, onChange })` that submits the selected value through `<input type="hidden" name={name} value={selected} />`, exposes a `Tag color` prompt button, and opens preset buttons with `aria-label="Use {label} tag color"`.

- [x] **Step 1: Write the failing test**

Update `apps/web/src/components/library/__tests__/tag-color-picker.test.tsx` to assert the custom picker contract:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TAG_COLOR_PRESETS,
  TagColorPicker,
} from "@/components/library/tag-color-picker";

describe("TagColorPicker", () => {
  it("submits a preset color through a named hidden input", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[0].value}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Tag color" });
    fireEvent.click(trigger);

    const amberButton = screen.getByRole("button", {
      name: "Use Amber tag color",
    });
    fireEvent.click(amberButton);

    const hiddenInput = container.querySelector('input[name="color"]');
    expect(onChange).toHaveBeenCalledWith(TAG_COLOR_PRESETS[2].value);
    expect(hiddenInput).toHaveAttribute("type", "hidden");
    expect(hiddenInput).toHaveValue(TAG_COLOR_PRESETS[2].value);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("syncs the selected color when the controlled value changes", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[0].value}
        onChange={onChange}
      />,
    );

    rerender(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[3].value}
        onChange={onChange}
      />,
    );

    expect(container.querySelector('input[name="color"]')).toHaveValue(
      TAG_COLOR_PRESETS[3].value,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tag color" }));

    expect(screen.getByRole("button", { name: "Use Red tag color" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `bun run test apps/web/src/components/library/__tests__/tag-color-picker.test.tsx`

Expected: FAIL because the current component exposes a native select or always-visible swatches instead of a selected-color prompt, color-block menu, and hidden input.

- [x] **Step 3: Implement the minimal custom picker**

In `apps/web/src/components/library/tag-color-picker.tsx`, remove the shared native `Select` import, render a hidden input, render the selected color as the prompt button, and render menu color buttons from `TAG_COLOR_PRESETS` when the prompt is open. Each option button should use the preset color as its background block, preserve the controlled `selected` mirror, call `onChange`, close the menu, and mark the current color with `aria-pressed`.

- [x] **Step 4: Update create-tag row layout**

In `apps/web/src/components/library/tag-panel.tsx`, place `<TagColorPicker />`, `<Input name="name" />`, and the submit `<Button />` in one responsive row. Use wrapping on small screens and keep the input flexible so the controls do not overflow.

- [x] **Step 5: Run focused test to verify it passes**

Run: `bun run test apps/web/src/components/library/__tests__/tag-color-picker.test.tsx`

Expected: PASS with both TagColorPicker tests green.

- [x] **Step 6: Run the full repo gate**

Run: `bun run check`

Expected: PASS.

Observed 2026-06-17: PASS. `bun run check` completed with 46 web test files
and 295 tests passing. Biome still reports two pre-existing unused-import
warnings outside this change.

## Self-Review

- Spec coverage: The plan covers the selected-color prompt, custom color-block menu, hidden form submission, controlled value syncing, desktop row alignment, and mobile wrapping.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: The component API remains `TagColorPicker({ name, value, onChange })`, and tests use the exported `TAG_COLOR_PRESETS`.

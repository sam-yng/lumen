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

    expect(
      screen.getByRole("button", { name: "Use Red tag color" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the options background tight to the color blocks", () => {
    const { container } = render(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[0].value}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tag color" }));

    const options = container.querySelector(
      '[data-testid="tag-color-options"]',
    );
    expect(options).toHaveClass("w-max");
    expect(options).toHaveClass("gap-1");
    expect(options).not.toHaveClass("gap-8");
  });
});

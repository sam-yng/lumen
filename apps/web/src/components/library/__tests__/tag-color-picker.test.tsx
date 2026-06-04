import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TAG_COLOR_PRESETS,
  TagColorPicker,
} from "@/components/library/tag-color-picker";

describe("TagColorPicker", () => {
  it("submits a preset color through a hidden form value", () => {
    const onChange = vi.fn();
    render(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[0].value}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: TAG_COLOR_PRESETS[2].label }),
    );

    expect(onChange).toHaveBeenCalledWith(TAG_COLOR_PRESETS[2].value);
    expect(
      screen.getByDisplayValue(TAG_COLOR_PRESETS[2].value),
    ).toHaveAttribute("name", "color");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TAG_COLOR_PRESETS,
  TagColorPicker,
} from "@/components/library/tag-color-picker";

describe("TagColorPicker", () => {
  it("submits a preset color through the named select", () => {
    const onChange = vi.fn();
    render(
      <TagColorPicker
        name="color"
        value={TAG_COLOR_PRESETS[0].value}
        onChange={onChange}
      />,
    );

    const select = screen.getByLabelText("Tag color");
    fireEvent.change(select, { target: { value: TAG_COLOR_PRESETS[2].value } });

    expect(onChange).toHaveBeenCalledWith(TAG_COLOR_PRESETS[2].value);
    expect(select).toHaveAttribute("name", "color");
    expect((select as HTMLSelectElement).value).toBe(
      TAG_COLOR_PRESETS[2].value,
    );
  });
});

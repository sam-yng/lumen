import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileUploadPicker } from "@/components/library/file-upload-picker";

describe("FileUploadPicker", () => {
  it("shows a selected file and clears it", () => {
    render(<FileUploadPicker name="file" />);
    const input = screen.getByLabelText("Choose file");
    const file = new File(["hello"], "lecture.mp3", { type: "audio/mpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("lecture.mp3")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove selected file" }),
    );

    expect(screen.queryByText("lecture.mp3")).not.toBeInTheDocument();
  });
});

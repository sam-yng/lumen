import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthForm } from "@/components/auth-form";
import type { AuthState } from "@/server/auth/actions";

async function noopAction(
  _prev: AuthState,
  _formData: FormData,
): Promise<AuthState> {
  return undefined;
}

describe("AuthForm", () => {
  it("shows confirm password only for signup", () => {
    const { rerender } = render(<AuthForm mode="signup" action={noopAction} />);

    expect(screen.getByLabelText("Confirm password")).toBeVisible();

    rerender(<AuthForm mode="login" action={noopAction} />);

    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });

  it("renders OTP entry when signup is pending confirmation", () => {
    render(
      <AuthForm
        mode="signup"
        action={noopAction}
        initialState={{ status: "otp-sent", email: "new@lumen.test" }}
      />,
    );

    expect(screen.getByText("Check your email")).toBeVisible();
    expect(screen.getByLabelText("Confirmation code")).toBeVisible();
    expect(screen.getByDisplayValue("new@lumen.test")).toBeInTheDocument();
  });

  it("shows validation errors in the OTP state", () => {
    render(
      <AuthForm
        mode="signup"
        action={noopAction}
        initialState={{
          status: "otp-sent",
          email: "new@lumen.test",
          error: "Enter the 6-digit code.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the 6-digit code.",
    );
  });
});

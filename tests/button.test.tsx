// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, IconButton } from "../src/components/Button";

afterEach(cleanup);

describe("Button", () => {
  it("runs the click and keeps one fixed label", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Play</Button>);
    const button = screen.getByRole("button", { name: "Play" });
    expect(button.className).toContain("ui-btn-secondary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps its size, blocks a second click and reports busy while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Starting…" onClick={onClick}>
        Play
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Starting…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Starting…" }).querySelector(".ui-btn-spinner")).toBeTruthy();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects a disabled button", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Play</Button>);
    const button = screen.getByRole("button", { name: "Play" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses fixed sizes and a primary variant for hierarchy", () => {
    const { rerender } = render(<Button size="lg" variant="primary">Play</Button>);
    expect(screen.getByRole("button", { name: "Play" }).className).toContain("ui-btn-lg");
    expect(screen.getByRole("button", { name: "Play" }).className).toContain("ui-btn-primary");
    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("ui-btn-sm");
  });

  it("gives an icon-only button an accessible name and an aria-hidden icon", () => {
    const onClick = vi.fn();
    render(<IconButton label="Refresh skin" icon={<span data-testid="icon">x</span>} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Refresh skin" });
    expect(button.className).toContain("ui-btn-icon");
    expect(button.querySelector(".ui-btn-label")).toBeNull();
    expect(button.querySelector("[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import { api } from "../src/api/client";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { appInfo, java17Raw, java21Raw, settingsState, systemInfo } from "./helpers/fixtures";

vi.mock("../src/api/client", () => ({
  api: {
    getAppInfo: vi.fn(),
    getSystemInfo: vi.fn(),
    detectJava: vi.fn(),
    inspectJava: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
  },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const mocked = vi.mocked(api);

function goTo(name: "Home" | "Settings" | "Diagnostics") {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  mocked.getAppInfo.mockResolvedValue(appInfo);
  mocked.getSystemInfo.mockResolvedValue(systemInfo);
  mocked.loadSettings.mockResolvedValue(settingsState());
  mocked.detectJava.mockResolvedValue({ installs: [java21Raw, java17Raw], candidatesChecked: 5 });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  delete document.documentElement.dataset.reduceMotion;
});

describe("Home", () => {
  it("shows the branding, the target version and the detected Java", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Limited FPS" })).toBeTruthy();
    expect(screen.getByText("Minecraft Java Edition 1.21.11")).toBeTruthy();
    expect(await screen.findByText("Java 21")).toBeTruthy();
    expect(screen.getAllByText("Not installed")).toHaveLength(2); // game files and Fabric
  });

  it("shows a loading state while Java is being detected", () => {
    mocked.detectJava.mockReturnValue(new Promise<never>(() => {}));
    render(<App />);
    expect(screen.getByRole("status", { name: "Detecting Java" })).toBeTruthy();
  });

  it("keeps Play disabled and says launching is not available", async () => {
    render(<App />);
    const play = (await screen.findByRole("button", { name: /not available yet/i })) as HTMLButtonElement;
    expect(play.disabled).toBe(true);
    fireEvent.click(play);
    expect(screen.getByText(/Launching Minecraft is not implemented yet/)).toBeTruthy();
    expect(screen.getByText("Microsoft account sign-in")).toBeTruthy();
    expect(screen.getAllByText("Not built yet")).toHaveLength(3);
  });

  it("explains when only an old Java is installed", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [java17Raw], candidatesChecked: 3 });
    render(<App />);
    expect(await screen.findByText("No Java 21+ found")).toBeTruthy();
  });

  it("shows an empty state when no Java exists, and can detect again", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 4 });
    render(<App />);
    expect(await screen.findByText("No Java found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detect again" }));
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledTimes(2));
  });

  it("shows the error and a retry button when detection fails", async () => {
    mocked.detectJava.mockRejectedValueOnce(new Error("could not scan"));
    render(<App />);
    expect(await screen.findByText("Java detection failed")).toBeTruthy();
    expect(screen.getByText("could not scan")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Java 21")).toBeTruthy();
  });

  it("passes the saved custom Java path to detection", async () => {
    mocked.loadSettings.mockResolvedValue(settingsState({ javaPath: "D:\\jdk\\bin\\java.exe" }));
    render(<App />);
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledWith("D:\\jdk\\bin\\java.exe"));
  });
});

describe("Diagnostics", () => {
  it("shows the system and Java results returned by the backend", async () => {
    render(<App />);
    goTo("Diagnostics");
    expect(await screen.findByText("AMD Ryzen 5 PRO 4650G with Radeon Graphics")).toBeTruthy();
    expect(screen.getByText("Windows 10 Pro 10 (19045)")).toBeTruthy();
    expect((await screen.findAllByText(java21Raw.path)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(java17Raw.path).length).toBeGreaterThan(0);
    expect(screen.getByText("Too old")).toBeTruthy();
  });

  it("shows an empty state when no Java is installed", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 4 });
    render(<App />);
    goTo("Diagnostics");
    expect(await screen.findByText("No Java installations found")).toBeTruthy();
  });

  it("shows an error when system information fails", async () => {
    mocked.getSystemInfo.mockRejectedValue(new Error("no sysinfo"));
    render(<App />);
    goTo("Diagnostics");
    expect(await screen.findByText("System information unavailable")).toBeTruthy();
    expect(screen.getByText("no sysinfo")).toBeTruthy();
  });

  it("copies the report to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<App />);
    goTo("Diagnostics");
    await screen.findByText("AMD Ryzen 5 PRO 4650G with Radeon Graphics");
    const copy = screen.getByRole("button", { name: "Copy report" }) as HTMLButtonElement;
    await waitFor(() => expect(copy.disabled).toBe(false));
    fireEvent.click(copy);
    expect(await screen.findByText("Report copied to the clipboard.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("Limited FPS diagnostics report");
  });

  it("tells the user when the clipboard is unavailable", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<App />);
    goTo("Diagnostics");
    const copy = (await screen.findByRole("button", { name: "Copy report" })) as HTMLButtonElement;
    await waitFor(() => expect(copy.disabled).toBe(false));
    fireEvent.click(copy);
    expect(await screen.findByText(/Could not use the clipboard/)).toBeTruthy();
  });
});

describe("Settings", () => {
  it("shows the saved values from the backend", async () => {
    mocked.loadSettings.mockResolvedValue(settingsState({ memoryMb: 6144 }));
    render(<App />);
    goTo("Settings");
    const memory = (await screen.findByLabelText("Memory in MB")) as HTMLInputElement;
    expect(memory.value).toBe("6144");
  });

  it("saves changed values and confirms", async () => {
    mocked.saveSettings.mockResolvedValue({
      ok: true,
      errors: [],
      state: settingsState({ memoryMb: 6144 }),
    });
    render(<App />);
    goTo("Settings");
    const memory = await screen.findByLabelText("Memory in MB");
    const save = screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // nothing changed yet

    fireEvent.change(memory, { target: { value: "6144" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ memoryMb: 6144 })),
    );
    expect(await screen.findByText("Settings saved.")).toBeTruthy();
    await waitFor(() => expect(save.disabled).toBe(true));
  });

  it("blocks invalid memory before calling the backend", async () => {
    render(<App />);
    goTo("Settings");
    fireEvent.change(await screen.findByLabelText("Memory in MB"), { target: { value: "512" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Memory must be at least 1024 MB.")).toBeTruthy();
    expect(mocked.saveSettings).not.toHaveBeenCalled();
  });

  it("shows errors the backend reports for a field", async () => {
    mocked.saveSettings.mockResolvedValue({
      ok: false,
      errors: [{ field: "javaPath", message: "No file found at Z:\\missing\\java.exe" }],
      state: null,
    });
    render(<App />);
    goTo("Settings");
    fireEvent.change(await screen.findByLabelText("Java executable"), {
      target: { value: "Z:\\missing\\java.exe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("No file found at Z:\\missing\\java.exe")).toBeTruthy();
  });

  it("shows a message when saving itself fails", async () => {
    mocked.saveSettings.mockRejectedValue(new Error("disk is read-only"));
    render(<App />);
    goTo("Settings");
    fireEvent.change(await screen.findByLabelText("Memory in MB"), { target: { value: "2048" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/disk is read-only/)).toBeTruthy();
  });

  it("discards unsaved edits", async () => {
    render(<App />);
    goTo("Settings");
    const memory = (await screen.findByLabelText("Memory in MB")) as HTMLInputElement;
    fireEvent.change(memory, { target: { value: "2048" } });
    expect(memory.value).toBe("2048");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(memory.value).toBe("4096");
  });

  it("resets to defaults only after confirmation", async () => {
    mocked.resetSettings.mockResolvedValue(settingsState({ memoryMb: 4096 }));
    render(<App />);
    goTo("Settings");
    fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
    expect(mocked.resetSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset" }));
    expect(await screen.findByText("Settings were reset to their defaults.")).toBeTruthy();
    expect(mocked.resetSettings).toHaveBeenCalledTimes(1);
  });

  it("tests a Java path and shows the result", async () => {
    mocked.inspectJava.mockResolvedValue(java17Raw);
    render(<App />);
    goTo("Settings");
    fireEvent.change(await screen.findByLabelText("Java executable"), { target: { value: java17Raw.path } });
    fireEvent.click(screen.getByRole("button", { name: "Test this Java" }));
    expect(await screen.findByText(/needs Java 21/)).toBeTruthy();
    expect(mocked.inspectJava).toHaveBeenCalledWith(java17Raw.path);
  });

  it("explains when settings were recovered from a damaged file", async () => {
    mocked.loadSettings.mockResolvedValue(
      settingsState({}, { status: "recoveredFromCorruption", message: "The settings file was damaged." }),
    );
    render(<App />);
    goTo("Settings");
    expect(await screen.findByText("Settings were restored to defaults")).toBeTruthy();
    expect(screen.getByText("The settings file was damaged.")).toBeTruthy();
  });

  it("shows an error and still detects Java when settings cannot be loaded", async () => {
    mocked.loadSettings.mockRejectedValue(new Error("no access"));
    render(<App />);
    goTo("Settings");
    expect(await screen.findByText("Settings could not be loaded")).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledWith(null));
  });

  it("applies the reduce-motion setting to the whole window", async () => {
    mocked.loadSettings.mockResolvedValue(settingsState({ reduceMotion: true }));
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.reduceMotion).toBe("true"));
  });
});

describe("ErrorBoundary", () => {
  it("shows a readable message instead of a blank window", () => {
    function Boom(): JSX.Element {
      throw new Error("kaboom");
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("kaboom");
    spy.mockRestore();
  });
});

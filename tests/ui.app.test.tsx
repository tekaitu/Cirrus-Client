// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";
import { api } from "../src/api/client";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import type { AuthStatus, DeviceCodeInfo, InstallProgress, InstallResult } from "../src/api/types";
import { appInfo, java17Raw, java21Raw, settingsState, systemInfo } from "./helpers/fixtures";

vi.mock("../src/api/client", () => ({
  api: {
    getAppInfo: vi.fn(),
    getSystemInfo: vi.fn(),
    detectJava: vi.fn(),
    inspectJava: vi.fn(),
    installJava: vi.fn(),
    cancelJavaInstall: vi.fn(),
    authStatus: vi.fn(),
    authRestore: vi.fn(),
    authSignIn: vi.fn(),
    authSignInWindow: vi.fn(),
    authCancel: vi.fn(),
    authSignOut: vi.fn(),
    openMicrosoftLink: vi.fn(),
    onAuthDeviceCode: vi.fn(),
    onJavaInstallProgress: vi.fn(),
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

let codeHandler: ((c: DeviceCodeInfo) => void) | null = null;

const authStatus = (extra: Partial<AuthStatus> = {}): AuthStatus => ({
  state: "notConfigured",
  configured: false,
  savedLogin: false,
  profile: null,
  message: null,
  ...extra,
});
const CLIENT_ID = "12345678-90ab-cdef-1234-567890abcdef";
const steve = { id: "0123456789abcdef0123456789abcdef", name: "Steve" };

let progressHandler: ((p: InstallProgress) => void) | null = null;

beforeEach(() => {
  progressHandler = null;
  mocked.onJavaInstallProgress.mockImplementation(async (handler) => {
    progressHandler = handler;
    return () => {};
  });
  mocked.cancelJavaInstall.mockResolvedValue(true);
  codeHandler = null;
  mocked.onAuthDeviceCode.mockImplementation(async (handler) => {
    codeHandler = handler;
    return () => {};
  });
  mocked.authStatus.mockResolvedValue(authStatus());
  mocked.authCancel.mockResolvedValue(true);
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
    expect(screen.getByRole("heading", { level: 1, name: /Sword PvP/ })).toBeTruthy();
    expect(screen.getByText("Minecraft Java Edition 1.21.11")).toBeTruthy();
    expect(await screen.findByText("Java 21")).toBeTruthy();
    expect(screen.getAllByText("Not installed")).toHaveLength(2); // game files and Fabric
  });

  it("has an icon-only sidebar with Home, Settings and Diagnostics", async () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Home", "Settings", "Diagnostics"]) {
      const button = screen.getByRole("button", { name });
      expect(nav.contains(button)).toBe(true);
      expect(button.textContent).toBe(""); // icon only
    }
    expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    await screen.findByText("Java 21");
  });

  it("shows local news cards, clearly labelled, with dates and categories", async () => {
    render(<App />);
    expect(screen.getByText(/not live news/i)).toBeTruthy();
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("1 Nov 2026")).toBeTruthy();
    expect(screen.getAllByText("Update").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tip").length).toBeGreaterThan(0);
    await screen.findByText("Java 21");
  });

  it("toolbar re-scans Java and opens Diagnostics for help", async () => {
    render(<App />);
    await screen.findByText("Java 21");
    fireEvent.click(screen.getByRole("button", { name: "Re-scan Java" }));
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("button", { name: /Community/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Get help" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Diagnostics" })).toBeTruthy();
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
    expect(screen.getAllByText("Not built yet")).toHaveLength(2); // game files and Fabric
    expect(screen.getByText("Sign-in needed")).toBeTruthy();
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

const installedResult = (extra: Partial<InstallResult> = {}): InstallResult => ({
  status: "installed",
  message: null,
  javaPath: "C:\\Users\\player\\AppData\\Local\\com.limitedfps.app\\runtime\\temurin-21\\jdk-21.0.5_11-jre\\bin\\java.exe",
  version: "21.0.5",
  source: "Limited FPS runtime",
  configured: true,
  settings: settingsState({
    javaPath:
      "C:\\Users\\player\\AppData\\Local\\com.limitedfps.app\\runtime\\temurin-21\\jdk-21.0.5_11-jre\\bin\\java.exe",
  }),
  ...extra,
});

describe("Microsoft account", () => {
  const configured = () => authStatus({ state: "signedOut", configured: true });

  it("explains that sign-in needs an Azure app ID and links to Settings", async () => {
    render(<App />);
    expect(await screen.findByText("Not signed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in with Microsoft" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set up sign-in (owner)" }));
    expect(await screen.findByLabelText("Azure application (client) ID")).toBeTruthy();
  });

  it("signs in with a device code and shows the real profile", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignIn.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    mocked.openMicrosoftLink.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a code instead" }));
    expect(await screen.findByText("Contacting Microsoft…")).toBeTruthy();

    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ABCD1234", verificationUri: "https://www.microsoft.com/link", expiresIn: 900 }));
    expect(await screen.findByText("ABCD1234")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Microsoft page" }));
    expect(mocked.openMicrosoftLink).toHaveBeenCalledWith("https://www.microsoft.com/link");

    await act(async () => finish(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve })));
    expect(await screen.findByText("Steve")).toBeTruthy();
    expect(screen.getByText("01234567-89ab-cdef-0123-456789abcdef")).toBeTruthy();
    const row = screen.getByText("Microsoft account sign-in").closest("li") as HTMLElement;
    expect(within(row).getByText("Ready")).toBeTruthy();
  });

  it("signs in through the Microsoft window and never asks for an app ID", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignInWindow.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    expect(await screen.findByText("Finish signing in in the Microsoft window…")).toBeTruthy();
    expect(mocked.authSignIn).not.toHaveBeenCalled();
    await act(async () => finish(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve })));
    expect(await screen.findByText("Steve")).toBeTruthy();
  });

  it("can cancel the sign-in window", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignInWindow.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mocked.authCancel).toHaveBeenCalledTimes(1);
    await act(async () => finish(authStatus({ state: "cancelled", configured: true })));
    expect(await screen.findByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
  });

  it("does not offer to open a code page that is not on microsoft.com", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    mocked.authSignIn.mockReturnValue(new Promise<AuthStatus>(() => {}));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a code instead" }));
    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ZZZZ", verificationUri: "https://evil.example.com/link", expiresIn: 900 }));
    expect(await screen.findByText(/unexpected address/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Microsoft page" })).toBeNull();
  });

  it("can be cancelled while waiting", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignIn.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a code instead" }));
    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ABCD1234", verificationUri: "https://www.microsoft.com/link", expiresIn: 900 }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mocked.authCancel).toHaveBeenCalledTimes(1);
    await act(async () => finish(authStatus({ state: "cancelled", configured: true })));
    expect(await screen.findByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
  });

  it("shows the reason when sign-in fails and lets the user retry", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    mocked.authSignInWindow.mockResolvedValueOnce(
      authStatus({
        state: "failed",
        configured: true,
        message: "This Microsoft account does not own Minecraft: Java Edition (no profile was found).",
      }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    expect(await screen.findByText("Sign-in problem")).toBeTruthy();
    expect(screen.getByText(/does not own Minecraft/)).toBeTruthy();
    mocked.authSignInWindow.mockResolvedValueOnce(authStatus({ state: "signedIn", configured: true, profile: steve }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Steve")).toBeTruthy();
  });

  it("restores a saved login at startup and can sign out", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.authSignOut.mockResolvedValue(authStatus({ state: "signedOut", configured: true }));
    render(<App />);
    expect(await screen.findByText("Steve")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
    expect(mocked.authSignOut).toHaveBeenCalledTimes(1);
  });

  it("tells the user when a saved login has expired", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(
      authStatus({ state: "signedOut", configured: true, message: "Your Microsoft sign-in expired or was revoked. Please sign in again." }),
    );
    render(<App />);
    expect(await screen.findByText(/expired or was revoked/)).toBeTruthy();
  });

  it("saves the Azure client ID from Settings and rejects a malformed one", async () => {
    mocked.saveSettings.mockResolvedValue({ ok: true, errors: [], state: settingsState({ msClientId: CLIENT_ID }) });
    render(<App />);
    goTo("Settings");
    const input = await screen.findByLabelText("Azure application (client) ID");
    fireEvent.change(input, { target: { value: "not-a-guid" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/00000000-0000-0000-0000-000000000000 \(the Application/)).toBeTruthy();
    expect(mocked.saveSettings).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: CLIENT_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ msClientId: CLIENT_ID })),
    );
  });
});

describe("Java installer", () => {
  beforeEach(() => {
    mocked.detectJava.mockResolvedValue({ installs: [java17Raw], candidatesChecked: 3 });
  });

  it("offers the install button only when no compatible Java exists", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Install Java 21" })).toBeTruthy();
    cleanup();
    mocked.detectJava.mockResolvedValue({ installs: [java21Raw], candidatesChecked: 3 });
    render(<App />);
    await screen.findByText("Java 21");
    expect(screen.queryByRole("button", { name: "Install Java 21" })).toBeNull();
  });

  it("shows progress, then re-detects with the new Java path after success", async () => {
    let finish: (r: InstallResult) => void = () => {};
    mocked.installJava.mockReturnValue(new Promise<InstallResult>((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));

    expect(await screen.findByText("Starting…")).toBeTruthy();
    await waitFor(() => expect(progressHandler).not.toBeNull());
    act(() =>
      progressHandler?.({ stage: "downloading", downloaded: 26_214_400, total: 52_428_800, message: "Downloading" }),
    );
    expect(await screen.findByText("25.0 MB of 50.0 MB")).toBeTruthy();
    const bar = screen.getByLabelText("Java download progress") as HTMLProgressElement;
    expect(bar.value).toBe(50);

    mocked.detectJava.mockResolvedValue({ installs: [java21Raw], candidatesChecked: 4 });
    await act(async () => finish(installedResult()));

    expect(await screen.findByText("Java 21 installed")).toBeTruthy();
    await waitFor(() =>
      expect(mocked.detectJava).toHaveBeenLastCalledWith(expect.stringContaining("temurin-21")),
    );
    expect(await screen.findByText("Java 21")).toBeTruthy();
  });

  it("can be cancelled while downloading", async () => {
    let finish: (r: InstallResult) => void = () => {};
    mocked.installJava.mockReturnValue(new Promise<InstallResult>((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    await waitFor(() => expect(progressHandler).not.toBeNull());
    act(() => progressHandler?.({ stage: "downloading", downloaded: 1000, total: 50_000_000, message: "x" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mocked.cancelJavaInstall).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Cancelling…")).toBeTruthy();

    await act(async () => finish({ ...installedResult(), status: "cancelled", settings: null, configured: false }));
    expect(await screen.findByText("Installation cancelled")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install again" })).toBeTruthy();
  });

  it("shows the error and lets the user retry", async () => {
    mocked.installJava.mockResolvedValueOnce({
      ...installedResult(),
      status: "failed",
      message: "The downloaded file did not match the vendor's checksum, so it was deleted and NOT used.",
      settings: null,
      configured: false,
      javaPath: null,
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    expect(await screen.findByText("Java could not be installed")).toBeTruthy();
    expect(screen.getByText(/did not match the vendor's checksum/)).toBeTruthy();

    mocked.installJava.mockResolvedValueOnce(installedResult());
    fireEvent.click(screen.getByRole("button", { name: "Retry install" }));
    expect(await screen.findByText("Java 21 installed")).toBeTruthy();
    expect(mocked.installJava).toHaveBeenCalledTimes(2);
  });

  it("shows an error when the install command itself fails", async () => {
    mocked.installJava.mockRejectedValue(new Error("A Java installation is already running."));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    expect(await screen.findByText("A Java installation is already running.")).toBeTruthy();
  });

  it("starts only one installation at a time", async () => {
    mocked.installJava.mockReturnValue(new Promise<InstallResult>(() => {}));
    render(<App />);
    const button = await screen.findByRole("button", { name: "Install Java 21" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(mocked.installJava).toHaveBeenCalledTimes(1));
  });

  it("reports an already-installed Java without changing Settings", async () => {
    mocked.installJava.mockResolvedValue({
      status: "alreadyInstalled",
      message: null,
      javaPath: java21Raw.path,
      version: "21.0.4",
      source: "Common install folder",
      configured: false,
      settings: null,
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    expect(await screen.findByText("Java 21 is already available")).toBeTruthy();
    expect(screen.getByText(/Nothing in Settings was changed/)).toBeTruthy();
  });

  it("is also available on the Diagnostics page", async () => {
    render(<App />);
    goTo("Diagnostics");
    expect(await screen.findByRole("button", { name: "Install Java 21" })).toBeTruthy();
  });
});

describe("Settings layout", () => {
  it("has section links, memory presets and a switch for reduce motion", async () => {
    render(<App />);
    goTo("Settings");
    await screen.findByLabelText("Memory slider");
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    for (const name of ["Memory", "Java", "Game folder", "Sign-in", "Interface"]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    expect(within(nav).getByRole("link", { name: "Java" }).getAttribute("href")).toBe("#sec-java");
    expect(document.getElementById("sec-java")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeTruthy();
  });

  it("memory presets fill in the memory and mark unsaved changes", async () => {
    render(<App />);
    goTo("Settings");
    await screen.findByLabelText("Memory slider");
    fireEvent.click(screen.getByRole("button", { name: "Use 2 GB" }));
    expect((screen.getByLabelText("Memory in MB") as HTMLInputElement).value).toBe("2048");
    expect(screen.getByRole("button", { name: "Use 2 GB" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(false);
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

  it("shows the version and executable path of the Java in use, and where it looked", async () => {
    mocked.detectJava.mockResolvedValue({
      installs: [java21Raw, java17Raw],
      candidatesChecked: 5,
      notes: ["JAVA_HOME is not set.", "PATH: 2 entries contain Java."],
    });
    render(<App />);
    goTo("Diagnostics");
    expect(await screen.findByText("Java in use")).toBeTruthy();
    expect(screen.getByText("Java 21 (21.0.4)")).toBeTruthy();
    expect(screen.getByText("Where Limited FPS looked (2)")).toBeTruthy();
    expect(screen.getByText("JAVA_HOME is not set.")).toBeTruthy();
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

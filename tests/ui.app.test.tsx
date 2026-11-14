// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";
import { api } from "../src/api/client";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import type { AuthStatus, DeviceCodeInfo, GameExit, GameProgress, GameStatus, InstallProgress, InstallResult } from "../src/api/types";
import { appInfo, java17Raw, java21Raw, settingsState, systemInfo } from "./helpers/fixtures";

vi.mock("../src/api/client", () => ({
  api: {
    getAppInfo: vi.fn(),
    gameStatus: vi.fn(),
    listInstances: vi.fn(),
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
    openCommunity: vi.fn(),
    listGameVersions: vi.fn(),
    quitApp: vi.fn(),
    curseforgeAvailable: vi.fn(),
    searchMods: vi.fn(),
    installMod: vi.fn(),
    listMods: vi.fn(),
    removeMod: vi.fn(),
    installGame: vi.fn(),
    cancelGameInstall: vi.fn(),
    launchGame: vi.fn(),
    stopGame: vi.fn(),
    onGameProgress: vi.fn(),
    onGameExited: vi.fn(),
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

function goTo(name: "Home" | "Library" | "Mods" | "Settings" | "Diagnostics") {
  fireEvent.click(screen.getByRole("button", { name }));
}

function openAccount() {
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
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

const gameStatus = (extra: Partial<GameStatus> = {}): GameStatus => ({
  installed: false,
  minecraft: "1.21.11",
  loader: null,
  gameDir: "C:\\Users\\player\\AppData\\Roaming\\com.limitedfps.app\\game",
  running: false,
  ...extra,
});
let gameProgressHandler: ((p: GameProgress) => void) | null = null;
let gameExitHandler: ((e: GameExit) => void) | null = null;

let progressHandler: ((p: InstallProgress) => void) | null = null;

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("unlimited.license", "2");
  mocked.listGameVersions.mockResolvedValue(["1.21.11", "1.21.1", "1.20.6"]);
  mocked.curseforgeAvailable.mockResolvedValue(false);
  mocked.listMods.mockResolvedValue([]);
  mocked.listInstances.mockResolvedValue([]);
  mocked.listProfiles.mockResolvedValue([]);
  mocked.openCommunity.mockResolvedValue(undefined);
  mocked.searchMods.mockResolvedValue({ hits: [], total: 0 });
  gameProgressHandler = null;
  gameExitHandler = null;
  mocked.gameStatus.mockResolvedValue(gameStatus());
  mocked.onGameProgress.mockImplementation(async (handler) => {
    gameProgressHandler = handler;
    return () => {};
  });
  mocked.onGameExited.mockImplementation(async (handler) => {
    gameExitHandler = handler;
    return () => {};
  });
  mocked.cancelGameInstall.mockResolvedValue(true);
  mocked.stopGame.mockResolvedValue(true);
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
    expect((await screen.findAllByText("Not installed")).length).toBeGreaterThanOrEqual(2); // game files and Fabric
  });

  it("has an icon-only rail with pages on top and tools at the bottom", async () => {
    render(<App />);
    const main = screen.getByRole("navigation", { name: "Main" });
    const tools = screen.getByRole("navigation", { name: "Tools" });
    for (const [nav, names] of [
      [main, ["Home", "Mods", "Library"]],
      [tools, ["Settings", "Diagnostics"]],
    ] as const) {
      for (const name of names) {
        const button = screen.getByRole("button", { name });
        expect(nav.contains(button)).toBe(true);
        expect(button.textContent).toBe(""); // icon only
      }
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

  it("rail re-scans Java and the footer opens Diagnostics for help", async () => {
    render(<App />);
    await screen.findByText("Java 21");
    fireEvent.click(screen.getByRole("button", { name: "Re-scan Java" }));
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /Discord community/ }));
    expect(mocked.openCommunity).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Get help" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Diagnostics" })).toBeTruthy();
  });

  it("shows a loading state while Java is being detected", () => {
    mocked.detectJava.mockReturnValue(new Promise<never>(() => {}));
    render(<App />);
    expect(screen.getByRole("status", { name: "Detecting Java" })).toBeTruthy();
  });

  it("offers Microsoft sign-in for online play, and says it is optional", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign in to play" })).toBeTruthy();
    expect(screen.getByText(/switch to “Offline name” to play without signing in/)).toBeTruthy();
    expect(screen.getByText("Microsoft sign-in (online play)")).toBeTruthy();
    expect(screen.getByText("Optional")).toBeTruthy();
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
  source: "Cirrus Client runtime",
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
    openAccount();
    expect(await screen.findByText("Not signed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in with Microsoft" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set up sign-in (owner)" }));
    expect(await screen.findByLabelText("Azure application (client) ID")).toBeTruthy();
  });

  it("lets the owner paste the app ID in the account menu and saves it", async () => {
    mocked.saveSettings.mockResolvedValue({ ok: true, errors: [], state: settingsState({ msClientId: CLIENT_ID }) });
    render(<App />);
    await screen.findByText("Java 21"); // settings have loaded by then
    openAccount();
    expect(await screen.findByText("How to get the app ID (one time, free)")).toBeTruthy();
    expect(screen.getByText("https://login.microsoftonline.com/consumers/oauth2/nativeclient")).toBeTruthy();
    const input = screen.getByLabelText("Application (client) ID");
    fireEvent.change(input, { target: { value: "not-a-guid" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText(/00000000-0000-0000-0000-000000000000 \(the Application/)).toBeTruthy();
    expect(mocked.saveSettings).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: CLIENT_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ msClientId: CLIENT_ID })),
    );
  });

  it("shows the reason when the app ID cannot be saved", async () => {
    mocked.saveSettings.mockResolvedValue({ ok: false, errors: [{ field: "msClientId", message: "Rejected by the backend." }], state: null });
    render(<App />);
    await screen.findByText("Java 21");
    openAccount();
    fireEvent.change(await screen.findByLabelText("Application (client) ID"), { target: { value: CLIENT_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Rejected by the backend.")).toBeTruthy();
  });

  it("signs in with a device code and shows the real profile", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignIn.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    mocked.openMicrosoftLink.mockResolvedValue(undefined);
    render(<App />);
    openAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Use a code instead" }));
    expect(await screen.findByText("Contacting Microsoft…")).toBeTruthy();

    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ABCD1234", verificationUri: "https://www.microsoft.com/link", expiresIn: 900 }));
    expect(await screen.findByText("ABCD1234")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Microsoft page" }));
    expect(mocked.openMicrosoftLink).toHaveBeenCalledWith("https://www.microsoft.com/link");

    await act(async () => finish(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve })));
    expect(await screen.findAllByText("Steve")).toBeTruthy();
    expect(screen.getByText("01234567-89ab-cdef-0123-456789abcdef")).toBeTruthy();
    const row = screen.getByText("Microsoft sign-in (online play)").closest("li") as HTMLElement;
    expect(within(row).getByText("Ready")).toBeTruthy();
  });

  it("signs in through the Microsoft window and never asks for an app ID", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignInWindow.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    render(<App />);
    openAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    expect(await screen.findByText("Finish signing in in the Microsoft window…")).toBeTruthy();
    expect(mocked.authSignIn).not.toHaveBeenCalled();
    await act(async () => finish(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve })));
    expect(await screen.findAllByText("Steve")).toBeTruthy();
  });

  it("can cancel the sign-in window", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignInWindow.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    render(<App />);
    openAccount();
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
    openAccount();
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
    openAccount();
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
    openAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    expect(await screen.findByText("Sign-in problem")).toBeTruthy();
    expect(screen.getByText(/does not own Minecraft/)).toBeTruthy();
    mocked.authSignInWindow.mockResolvedValueOnce(authStatus({ state: "signedIn", configured: true, profile: steve }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("Steve")).toBeTruthy();
  });

  it("restores a saved login at startup and can sign out", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.authSignOut.mockResolvedValue(authStatus({ state: "signedOut", configured: true }));
    render(<App />);
    openAccount();
    expect(await screen.findAllByText("Steve")).toBeTruthy();
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
    openAccount();
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
    expect(screen.getByText("Where Cirrus Client looked (2)")).toBeTruthy();
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
    expect(String(writeText.mock.calls[0][0])).toContain("Cirrus Client diagnostics report");
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

describe("Play", () => {
  const ready = () => mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
  const owned = () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
  };
  const waitReady = async () => {
    await screen.findByText("Java 21");
    await screen.findAllByText("Installed");
    await screen.findAllByText("Steve");
  };
  const chooseOffline = () => fireEvent.click(screen.getByRole("radio", { name: "Offline name" }));
  beforeEach(() => owned());

  it("shows setup progress that fills in as each step is done", async () => {
    ready();
    render(<App />);
    await waitReady();
    const steps = screen.getByRole("list", { name: "Setup progress" });
    expect(within(steps).getByText("Account")).toBeTruthy();
    expect(within(steps).getByText("Java")).toBeTruthy();
    expect(within(steps).getByText("Game files")).toBeTruthy();
    expect(within(steps).getAllByText("✓")).toHaveLength(3);
  });

  it("starts with the game files still to do when they are missing", async () => {
    render(<App />);
    await screen.findByText("Java 21");
    await screen.findAllByText("Steve");
    const steps = screen.getByRole("list", { name: "Setup progress" });
    await waitFor(() => expect(within(steps).getAllByText("✓")).toHaveLength(2));
  });

  it("sets everything up in one click: downloads the game, then starts it", async () => {
    mocked.installGame.mockImplementation(async () => {
      mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
      return { status: "installed", message: null, loader: "0.17.0" };
    });
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    await waitFor(() => expect(mocked.installGame).toHaveBeenCalledWith("1.21.11", "fabric"));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.stringContaining("java"), "microsoft", null, "1.21.11", "fabric"),
    );
  });

  it("shows download progress and can cancel", async () => {
    let finish: (r: { status: "installed" | "cancelled" | "failed"; message: string | null; loader: string | null }) => void = () => {};
    mocked.installGame.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    await waitFor(() => expect(gameProgressHandler).not.toBeNull());
    act(() => gameProgressHandler?.({ stage: "downloading", done: 50, total: 200, message: "Downloading game files (50 of 200)" }));
    expect(await screen.findByText("Downloading game files (50 of 200)")).toBeTruthy();
    expect((screen.getByLabelText("Game download progress") as HTMLProgressElement).value).toBe(25);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocked.cancelGameInstall).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: "cancelled", message: null, loader: null }));
    expect(await screen.findByText(/Download cancelled/)).toBeTruthy();
    expect(mocked.launchGame).not.toHaveBeenCalled();
  });

  it("shows why a download failed and does not start the game", async () => {
    mocked.installGame.mockResolvedValue({ status: "failed", message: "Could not connect.", loader: null });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    expect(await screen.findByText("Game files could not be downloaded")).toBeTruthy();
    expect(screen.getByText("Could not connect.")).toBeTruthy();
    expect(mocked.launchGame).not.toHaveBeenCalled();
  });

  it("installs Java first when it is missing", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 2 });
    mocked.installJava.mockReturnValue(new Promise<InstallResult>(() => {}));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    expect(screen.getByText(/Installs Java 21/)).toBeTruthy();
    await waitFor(() => expect(mocked.installJava).toHaveBeenCalledTimes(1));
  });

  it("lets the player pick the Minecraft version and the loader", async () => {
    ready();
    render(<App />);
    await waitReady();
    const select = screen.getByLabelText("Minecraft version") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["1.21.11", "1.21.1", "1.20.6"]);
    fireEvent.change(select, { target: { value: "1.20.6" } });
    await waitFor(() => expect(mocked.gameStatus).toHaveBeenLastCalledWith("1.20.6", "fabric"));
    fireEvent.click(screen.getByRole("radio", { name: "Vanilla" }));
    await waitFor(() => expect(mocked.gameStatus).toHaveBeenLastCalledWith("1.20.6", "vanilla"));
    expect(window.localStorage.getItem("unlimited.version")).toBe("1.20.6");
    expect(screen.getByText("Why is there no OptiFine?")).toBeTruthy();
  });

  it("asks to sign in when the Minecraft account is not signed in", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to play" }));
    expect(await screen.findByRole("dialog", { name: "Account" })).toBeTruthy();
  });

  it("plays offline without any Microsoft sign-in", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await screen.findByText("Java 21");
    await screen.findAllByText("Installed");
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.any(String), "offline", "Alex", "1.21.11", "fabric"),
    );
  });

  it("validates the offline player name before Play is allowed", async () => {
    ready();
    render(<App />);
    await waitReady();
    chooseOffline();
    const play = screen.getByRole("button", { name: "Play" }) as HTMLButtonElement;
    expect(play.disabled).toBe(true);
    const input = screen.getByLabelText("Player name");
    fireEvent.change(input, { target: { value: "bad name" } });
    fireEvent.blur(input);
    expect(await screen.findByText("Use only letters, numbers and underscores.")).toBeTruthy();
    expect(play.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Steve_01" } });
    expect(play.disabled).toBe(false);
  });

  it("launches offline with the chosen name, version and loader, then shows the running state", async () => {
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: "C:\\log.txt" });
    render(<App />);
    await waitReady();
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Steve_01" } });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.stringContaining("java"), "offline", "Steve_01", "1.21.11", "fabric"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Stop Minecraft" }));
    expect(mocked.stopGame).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(gameExitHandler).not.toBeNull());
    act(() => gameExitHandler?.({ code: 0, logPath: "C:\\log.txt" }));
    expect(await screen.findByText(/closed normally/)).toBeTruthy();
  });

  it("launches with the signed-in Microsoft account", async () => {
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await waitReady();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.any(String), "microsoft", null, "1.21.11", "fabric"),
    );
  });

  it("shows the reason when Minecraft cannot start", async () => {
    ready();
    mocked.launchGame.mockResolvedValue({ started: false, message: "A game file is missing.", logPath: null });
    render(<App />);
    await waitReady();
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Steve" } });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(await screen.findByText("Minecraft could not be started")).toBeTruthy();
    expect(screen.getByText("A game file is missing.")).toBeTruthy();
  });
});

describe("License", () => {
  it("must be accepted before the launcher is used", async () => {
    window.localStorage.removeItem("unlimited.license");
    render(<App />);
    const dialog = await screen.findByRole("dialog", { name: "Cirrus Client license" });
    expect(within(dialog).getByText(/You need Minecraft/)).toBeTruthy();
    const accept = within(dialog).getByRole("button", { name: "Accept and continue" }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(accept);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cirrus Client license" })).toBeNull());
    expect(window.localStorage.getItem("unlimited.license")).toBe("2");
  });

  it("quits when declined", async () => {
    window.localStorage.removeItem("unlimited.license");
    mocked.quitApp.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline and quit" }));
    expect(mocked.quitApp).toHaveBeenCalledTimes(1);
  });

  it("can be read again from the footer", async () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Cirrus Client license" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "License" }));
    const dialog = await screen.findByRole("dialog", { name: "Cirrus Client license" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Cirrus Client license" })).toBeNull();
  });
});

describe("Profiles", () => {
  const pvp = { id: "p-pvp", name: "PvP", minecraft: "1.21.11", fabric: true, color: 0 };
  const ready = () => mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
  const chooseOffline = () => fireEvent.click(screen.getByRole("radio", { name: "Offline name" }));

  it("creates a profile from a name, version and loader", async () => {
    mocked.createProfile.mockResolvedValue(pvp);
    render(<App />);
    goTo("Library");
    fireEvent.click(await screen.findByRole("button", { name: "Create profile" }));
    expect(await screen.findByText("Give the profile a name.")).toBeTruthy();
    expect(mocked.createProfile).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Profile name"), { target: { value: "PvP" } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    await waitFor(() => expect(mocked.createProfile).toHaveBeenCalledWith("PvP", "1.21.11", "fabric"));
  });

  it("lists profiles, plays one and passes it to the launcher", async () => {
    mocked.listProfiles.mockResolvedValue([pvp]);
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await screen.findByText("Java 21");
    goTo("Library");
    expect(await screen.findByText("Minecraft 1.21.11 · Fabric")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play profile PvP" }));
    expect(await screen.findByText("Profile:")).toBeTruthy();
    await screen.findAllByText("Installed");
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.any(String), "offline", "Alex", "1.21.11", "fabric", "p-pvp"),
    );
  });

  it("deletes a profile only after a second click", async () => {
    mocked.listProfiles.mockResolvedValue([pvp]);
    mocked.deleteProfile.mockResolvedValue(undefined);
    render(<App />);
    goTo("Library");
    fireEvent.click(await screen.findByRole("button", { name: "Delete profile PvP" }));
    expect(mocked.deleteProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete PvP" }));
    await waitFor(() => expect(mocked.deleteProfile).toHaveBeenCalledWith("p-pvp"));
  });
});

describe("Themes", () => {
  it("switches theme and accent at once and remembers them", async () => {
    render(<App />);
    goTo("Settings");
    fireEvent.click(await screen.findByRole("radio", { name: "Ocean theme" }));
    expect(document.documentElement.dataset.theme).toBe("ocean");
    expect(window.localStorage.getItem("unlimited.theme")).toBe("ocean");
    fireEvent.click(screen.getByRole("radio", { name: "Pink accent" }));
    expect(document.documentElement.dataset.accent).toBe("pink");
    expect(screen.getByRole("radio", { name: "Ocean theme" }).getAttribute("aria-checked")).toBe("true");
  });

  it("offers the Discord community from Settings", async () => {
    render(<App />);
    goTo("Settings");
    fireEvent.click(await screen.findByRole("button", { name: "Join the Discord community" }));
    expect(mocked.openCommunity).toHaveBeenCalledTimes(1);
  });
});

describe("Library", () => {
  it("says when nothing is installed yet", async () => {
    render(<App />);
    goTo("Library");
    expect(await screen.findByText("Nothing installed yet")).toBeTruthy();
  });

  it("lists installed setups and picks one for playing", async () => {
    mocked.listInstances.mockResolvedValue([
      { minecraft: "1.21.11", loader: "0.17.0", modCount: 3 },
      { minecraft: "1.20.6", loader: null, modCount: 0 },
    ]);
    render(<App />);
    goTo("Library");
    expect(await screen.findByText("Fabric 0.17.0 · 3 mods")).toBeTruthy();
    expect(screen.getByText("Vanilla", { selector: "p" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play Minecraft 1.20.6 vanilla" }));
    expect(await screen.findByLabelText("Minecraft version")).toBeTruthy();
    expect((screen.getByLabelText("Minecraft version") as HTMLSelectElement).value).toBe("1.20.6");
    expect(window.localStorage.getItem("unlimited.loader")).toBe("vanilla");
  });
});

describe("Mods", () => {
  const sodium = {
    provider: "modrinth" as const,
    id: "AANobbMI",
    title: "Sodium",
    description: "Fast rendering",
    author: "jellysquid3",
    downloads: 1_500_000,
    iconUrl: null,
    pageUrl: null,
  };
  const withFabric = () => mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));

  it("explains that Vanilla cannot load mods and can switch to Fabric", async () => {
    window.localStorage.setItem("unlimited.loader", "vanilla");
    render(<App />);
    goTo("Mods");
    expect(await screen.findByText("Mods need Fabric")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Fabric" }));
    await waitFor(() => expect(screen.queryByText("Mods need Fabric")).toBeNull());
  });

  it("asks to install the game with Fabric first", async () => {
    render(<App />);
    goTo("Mods");
    expect(await screen.findByText(/Install Minecraft 1.21.11 with Fabric first/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Install performance pack" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("installs the HUD pack and says which mods have no build for this version yet", async () => {
    withFabric();
    mocked.installMod.mockImplementation(async (_p: string, id: string) => {
      if (id === "cps-plus") throw new Error("No version of this mod is available for the chosen Minecraft version and loader.");
      return { installed: [`${id}.jar`], present: [] };
    });
    render(<App />);
    goTo("Mods");
    const pack = await screen.findByRole("button", { name: "Install HUD pack" });
    await waitFor(() => expect((pack as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(pack);
    await waitFor(() => expect(mocked.installMod).toHaveBeenCalledTimes(5));
    expect(mocked.installMod).toHaveBeenCalledWith("modrinth", "modern-keystrokes", "1.21.11");
    expect(await screen.findByText(/HUD & PvP pack installed.*Not available for Minecraft 1.21.11 yet: CPS\+/)).toBeTruthy();
  });

  it("searches Modrinth for the chosen version and installs a mod", async () => {
    withFabric();
    mocked.searchMods.mockResolvedValue({ hits: [sodium], total: 1 });
    mocked.installMod.mockResolvedValue({ installed: ["sodium.jar", "fabric-api.jar"], present: [] });
    render(<App />);
    goTo("Mods");
    expect(await screen.findByRole("heading", { name: "Sodium" })).toBeTruthy();
    expect(mocked.searchMods).toHaveBeenCalledWith("modrinth", "", "1.21.11", 0);
    expect(screen.getByText(/1.5M downloads/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search mods"), { target: { value: "sod" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(mocked.searchMods).toHaveBeenLastCalledWith("modrinth", "sod", "1.21.11", 0));

    const install = await screen.findByRole("button", { name: "Install Sodium" });
    await waitFor(() => expect((install as HTMLButtonElement).disabled).toBe(false));
    mocked.listMods.mockResolvedValue([{ fileName: "sodium.jar", size: 2_097_152 }]);
    fireEvent.click(install);
    await waitFor(() => expect(mocked.installMod).toHaveBeenCalledWith("modrinth", "AANobbMI", "1.21.11"));
    expect(await screen.findByText(/Sodium installed \(2 files/)).toBeTruthy();
    expect(await screen.findByText("sodium.jar")).toBeTruthy();
    expect(screen.getByText("2.0 MB")).toBeTruthy();
  });

  it("installs the performance pack and removes an installed mod", async () => {
    withFabric();
    mocked.installMod.mockResolvedValue({ installed: ["x.jar"], present: [] });
    mocked.listMods.mockResolvedValue([{ fileName: "lithium.jar", size: 1024 }]);
    mocked.removeMod.mockResolvedValue(undefined);
    render(<App />);
    goTo("Mods");
    const pack = await screen.findByRole("button", { name: "Install performance pack" });
    await waitFor(() => expect((pack as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(pack);
    await waitFor(() => expect(mocked.installMod).toHaveBeenCalledTimes(7));
    expect(mocked.installMod).toHaveBeenCalledWith("modrinth", "sodium", "1.21.11");
    expect(await screen.findByText(/Performance pack installed/)).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Remove lithium.jar" }));
    await waitFor(() => expect(mocked.removeMod).toHaveBeenCalledWith("1.21.11", "lithium.jar"));
  });

  it("shows why a mod could not be installed", async () => {
    withFabric();
    mocked.searchMods.mockResolvedValue({ hits: [sodium], total: 1 });
    mocked.installMod.mockRejectedValue(new Error("No version of this mod is available."));
    render(<App />);
    goTo("Mods");
    const install = await screen.findByRole("button", { name: "Install Sodium" });
    await waitFor(() => expect((install as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(install);
    expect(await screen.findByText(/No version of this mod is available/)).toBeTruthy();
  });

  it("says CurseForge needs a key when this build has none", async () => {
    render(<App />);
    goTo("Mods");
    fireEvent.click(await screen.findByRole("tab", { name: "CurseForge" }));
    expect(await screen.findByText(/needs an API key/)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";
import { initTheme } from "../src/core/theme";
import { notify, resetNotifications } from "../src/core/notifications";
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
    openGithub: vi.fn(),
    discordSetPresence: vi.fn(),
    discordClearPresence: vi.fn(),
    listSkins: vi.fn(),
    addSkinFile: vi.fn(),
    addSkinPlayer: vi.fn(),
    addSkinUrl: vi.fn(),
    setSkinModel: vi.fn(),
    removeSkin: vi.fn(),
    applySkin: vi.fn(),
    playerSkin: vi.fn(),
    setModEnabled: vi.fn(),
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
    readGameLog: vi.fn(),
    openGameFolder: vi.fn(),
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

function goTo(name: "Home" | "Versions" | "Browse" | "Modpacks" | "Mods" | "Skins" | "Servers" | "Settings") {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** About lives in the footer (and in Settings). */
function goToAbout() {
  fireEvent.click(screen.getAllByRole("button", { name: "About" })[0]!);
}

/** Diagnostics is reached from Settings. */
async function goToDiagnostics() {
  goTo("Settings");
  fireEvent.click(await screen.findByRole("button", { name: "Diagnostics" }));
}

/** Accounts is reached from the account menu. */
async function goToAccounts() {
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  fireEvent.click(await screen.findByRole("button", { name: "Manage accounts" }));
}

/** Waits until the first Java scan has been asked for, so the screen has stopped changing. */
async function settled() {
  await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
}

/** Waits until Java and the game files have both been looked at and the screen has caught up. */
async function loaded() {
  await settled();
  await waitFor(() => expect(mocked.gameStatus).toHaveBeenCalled());
  await act(async () => {});
}

async function goToSettings(tab?: string) {
  goTo("Settings");
  if (tab) fireEvent.click(await screen.findByRole("tab", { name: tab }));
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
  mocked.openGithub.mockResolvedValue(undefined);
  mocked.listSkins.mockResolvedValue([]);
  mocked.discordSetPresence.mockResolvedValue("ok");
  mocked.readGameLog.mockResolvedValue({ text: "", offset: 0 });
  mocked.openGameFolder.mockResolvedValue(undefined);
  mocked.discordClearPresence.mockResolvedValue(undefined);
  mocked.playerSkin.mockResolvedValue(null);
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
  resetNotifications();
  vi.resetAllMocks();
  delete document.documentElement.dataset.reduceMotion;
});

describe("Home", () => {
  it("shows the big title, the Play button and nothing else", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: /1\.21\.11\s+Fabric/ })).toBeTruthy();
    expect(screen.getByText("Minecraft Java Edition")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Sign in to play" })).toBeTruthy();
    // No status chips, news, shortcuts or recent-play cards on Home.
    expect(screen.queryByText(/not live news/i)).toBeNull();
    expect(screen.queryByText("Launcher news")).toBeNull();
    expect(screen.queryByText("Java 21")).toBeNull();
    expect(screen.queryByRole("list", { name: "Setup progress" })).toBeNull();
    expect(screen.getByRole("button", { name: "All versions" })).toBeTruthy();
  });

  it("has a top bar with the page tabs, a bell, Settings and the account", async () => {
    render(<App />);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Home", "Versions", "Browse", "Mods", "Modpacks", "Skins", "Servers"]) {
      expect(main.contains(screen.getByRole("button", { name }))).toBe(true);
    }
    for (const name of ["Accounts", "About", "Diagnostics", "Re-scan Java", "Discord Presence"]) {
      expect(main.contains(screen.queryByRole("button", { name }))).toBe(false);
    }
    expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();
    await settled();
  });

  it("lets the Discord status be switched off in Settings", async () => {
    render(<App />);
    goTo("Settings");
    const toggle = (await screen.findByRole("switch", { name: "Discord Presence" })) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    await waitFor(() => expect(mocked.discordClearPresence).toHaveBeenCalled());
    expect(window.localStorage.getItem("cirrus.discordPresence")).toBe("off");
  });

  it("jumps between pages with Alt + a number", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "4", altKey: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Mod manager" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "6", altKey: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Skins" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "7", altKey: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Servers" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "3", altKey: true, ctrlKey: true }); // not ours
    expect(screen.getByRole("heading", { level: 1, name: "Servers" })).toBeTruthy();
    await settled();
  });

  it("re-scans Java from Settings and opens Discord from the footer", async () => {
    render(<App />);
    await settled();
    fireEvent.click(screen.getByRole("button", { name: "Discord" }));
    expect(mocked.openCommunity).toHaveBeenCalledTimes(1);
    goTo("Settings");
    fireEvent.click(await screen.findByRole("button", { name: "Re-scan Java" }));
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledTimes(2));
  });

  it("opens About from the footer", async () => {
    render(<App />);
    goToAbout();
    expect(await screen.findByRole("heading", { level: 1, name: "About" })).toBeTruthy();
    expect(screen.getByText(/NOT AN OFFICIAL MINECRAFT PRODUCT/)).toBeTruthy();
    await settled();
  });

  it("warns in the footer only when Java is a problem", async () => {
    render(<App />);
    await settled();
    expect(screen.queryByRole("button", { name: /Java needs attention/ })).toBeNull();
    cleanup();
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 2 });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Java needs attention/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Diagnostics" })).toBeTruthy();
  });

  it("shows empty, then real notifications, in the bell", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();

    act(() => notify({ title: "Sodium installed", body: "Minecraft 1.21.11", tone: "good" }));
    expect(await screen.findByRole("button", { name: "Notifications, 1 new" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 new" }));
    expect(screen.getByText("Sodium installed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
    await settled();
  });

  it("has an empty Servers page that makes nothing up", async () => {
    render(<App />);
    goTo("Servers");
    expect(await screen.findByRole("heading", { level: 1, name: "Servers" })).toBeTruthy();
    expect(screen.getByText("No partner servers yet")).toBeTruthy();
    await settled();
  });

  it("shows a loading state while Java is being detected", async () => {
    mocked.detectJava.mockReturnValue(new Promise<never>(() => {}));
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByRole("status", { name: "Detecting Java" })).toBeTruthy();
  });

  it("explains when only an old Java is installed", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [java17Raw], candidatesChecked: 3 });
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByText(/None is compatible with Minecraft/)).toBeTruthy();
  });

  it("shows an empty state when no Java exists, and can detect again", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 4 });
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByText("No Java installations found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detect again" }));
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalledTimes(2));
  });

  it("shows the error and can detect again when detection fails", async () => {
    mocked.detectJava.mockRejectedValueOnce(new Error("could not scan"));
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByText("Java detection failed")).toBeTruthy();
    expect(screen.getByText("could not scan")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detect again" }));
    expect((await screen.findAllByText("Java 21")).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText("Not signed in")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Sign in with Microsoft" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set up sign-in (owner)" }));
    expect(await screen.findByLabelText("Azure application (client) ID")).toBeTruthy();
  });

  it("lets the owner paste the app ID in the account menu and saves it", async () => {
    mocked.saveSettings.mockResolvedValue({ ok: true, errors: [], state: settingsState({ msClientId: CLIENT_ID }) });
    render(<App />);
    await settled();
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
    await settled();
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Use the Microsoft window instead" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Use the Microsoft window instead" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ABCD1234", verificationUri: "https://www.microsoft.com/link", expiresIn: 900 }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mocked.authCancel).toHaveBeenCalledTimes(1);
    await act(async () => finish(authStatus({ state: "cancelled", configured: true })));
    expect(await screen.findByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
  });

  it("shows the reason when sign-in fails and lets the user retry", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    mocked.authSignIn.mockResolvedValueOnce(
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
    mocked.authSignIn.mockResolvedValueOnce(authStatus({ state: "signedIn", configured: true, profile: steve }));
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
    await goToDiagnostics();
    expect(await screen.findByRole("button", { name: "Install Java 21" })).toBeTruthy();
    cleanup();
    mocked.detectJava.mockResolvedValue({ installs: [java21Raw], candidatesChecked: 3 });
    render(<App />);
    await goToDiagnostics();
    expect((await screen.findAllByText("Java 21")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Install Java 21" })).toBeNull();
  });

  it("shows progress, then re-detects with the new Java path after success", async () => {
    let finish: (r: InstallResult) => void = () => {};
    mocked.installJava.mockReturnValue(new Promise<InstallResult>((resolve) => (finish = resolve)));
    render(<App />);
    await goToDiagnostics();
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
    expect((await screen.findAllByText("Java 21")).length).toBeGreaterThan(0);
  });

  it("can be cancelled while downloading", async () => {
    let finish: (r: InstallResult) => void = () => {};
    mocked.installJava.mockReturnValue(new Promise<InstallResult>((resolve) => (finish = resolve)));
    render(<App />);
    await goToDiagnostics();
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
    await goToDiagnostics();
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
    await goToDiagnostics();
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    expect(await screen.findByText("A Java installation is already running.")).toBeTruthy();
  });

  it("starts only one installation at a time", async () => {
    mocked.installJava.mockReturnValue(new Promise<InstallResult>(() => {}));
    render(<App />);
    await goToDiagnostics();
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
    await goToDiagnostics();
    fireEvent.click(await screen.findByRole("button", { name: "Install Java 21" }));
    expect(await screen.findByText("Java 21 is already available")).toBeTruthy();
    expect(screen.getByText(/Nothing in Settings was changed/)).toBeTruthy();
  });
});

describe("Settings layout", () => {
  it("has nine sections and shows one at a time", async () => {
    render(<App />);
    goTo("Settings");
    const nav = await screen.findByRole("tablist", { name: "Settings sections" });
    const names = [
      "General",
      "Appearance",
      "Performance",
      "Minecraft",
      "Memory and RAM",
      "Game directory",
      "Launch settings",
      "Keybinds",
      "Updates",
    ];
    for (const name of names) expect(within(nav).getByRole("tab", { name })).toBeTruthy();
    expect(within(nav).getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByLabelText("Memory slider")).toBeNull(); // another section
    fireEvent.click(within(nav).getByRole("tab", { name: "Memory and RAM" }));
    expect(await screen.findByLabelText("Memory slider")).toBeTruthy();
    fireEvent.click(within(nav).getByRole("tab", { name: "Appearance" }));
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeTruthy();
  });

  it("keeps unsaved edits when moving between sections", async () => {
    render(<App />);
    await goToSettings("Memory and RAM");
    fireEvent.click(await screen.findByRole("button", { name: "Use 2 GB" }));
    fireEvent.click(screen.getByRole("tab", { name: "Game directory" }));
    expect(await screen.findByRole("textbox", { name: "Game directory" })).toBeTruthy();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Memory and RAM" }));
    expect((screen.getByLabelText("Memory in MB") as HTMLInputElement).value).toBe("2048");
  });

  it("lists the fixed keyboard shortcuts and says in-game keybinds come later", async () => {
    render(<App />);
    await goToSettings("Keybinds");
    expect(await screen.findByText("Go to Mods")).toBeTruthy();
    expect(screen.getByText("Go to Skins")).toBeTruthy();
    expect(screen.getByText(/In-game keybinds come with the in-game client/)).toBeTruthy();
  });

  it("remembers the default Minecraft version from the Minecraft section", async () => {
    render(<App />);
    await goToSettings("Minecraft");
    fireEvent.change(await screen.findByLabelText("Default Minecraft version"), { target: { value: "1.20.6" } });
    expect(window.localStorage.getItem("unlimited.version")).toBe("1.20.6");
    fireEvent.click(screen.getByRole("radio", { name: "Vanilla" }));
    expect(window.localStorage.getItem("unlimited.loader")).toBe("vanilla");
  });

  it("remembers whether Play starts online or offline, and the offline name", async () => {
    render(<App />);
    await goToSettings("Launch settings");
    fireEvent.click(await screen.findByRole("radio", { name: "Offline name" }));
    fireEvent.change(screen.getByLabelText("Offline player name"), { target: { value: "Alex" } });
    expect(window.localStorage.getItem("unlimited.playMode")).toBe("offline");
    expect(window.localStorage.getItem("unlimited.username")).toBe("Alex");
  });

  it("opens the GitHub page from Updates", async () => {
    render(<App />);
    await goToSettings("Updates");
    fireEvent.click(await screen.findByRole("button", { name: "Open the GitHub page" }));
    expect(mocked.openGithub).toHaveBeenCalledTimes(1);
  });

  it("memory presets fill in the memory and mark unsaved changes", async () => {
    render(<App />);
    await goToSettings("Memory and RAM");
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
    await goToDiagnostics();
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
    await goToDiagnostics();
    expect(await screen.findByText("Java in use")).toBeTruthy();
    expect(screen.getByText("Java 21 (21.0.4)")).toBeTruthy();
    expect(screen.getByText("Where Cirrus Client looked (2)")).toBeTruthy();
    expect(screen.getByText("JAVA_HOME is not set.")).toBeTruthy();
  });

  it("shows an empty state when no Java is installed", async () => {
    mocked.detectJava.mockResolvedValue({ installs: [], candidatesChecked: 4 });
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByText("No Java installations found")).toBeTruthy();
  });

  it("shows an error when system information fails", async () => {
    mocked.getSystemInfo.mockRejectedValue(new Error("no sysinfo"));
    render(<App />);
    await goToDiagnostics();
    expect(await screen.findByText("System information unavailable")).toBeTruthy();
    expect(screen.getByText("no sysinfo")).toBeTruthy();
  });

  it("copies the report to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<App />);
    await goToDiagnostics();
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
    await goToDiagnostics();
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
    await goToSettings("Memory and RAM");
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
    await goToSettings("Memory and RAM");
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
    await goToSettings("Memory and RAM");
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
    await goToSettings("Performance");
    fireEvent.change(await screen.findByLabelText("Java executable"), {
      target: { value: "Z:\\missing\\java.exe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("No file found at Z:\\missing\\java.exe")).toBeTruthy();
  });

  it("shows a message when saving itself fails", async () => {
    mocked.saveSettings.mockRejectedValue(new Error("disk is read-only"));
    render(<App />);
    await goToSettings("Memory and RAM");
    fireEvent.change(await screen.findByLabelText("Memory in MB"), { target: { value: "2048" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/disk is read-only/)).toBeTruthy();
  });

  it("discards unsaved edits", async () => {
    render(<App />);
    await goToSettings("Memory and RAM");
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
    await goToSettings("Performance");
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
    await loaded();
    await screen.findAllByText("Steve");
  };
  const chooseOffline = () => fireEvent.click(screen.getByRole("radio", { name: "Offline name" }));
  beforeEach(() => owned());

  it("shows setup progress that fills in as each step is done", async () => {
    ready();
    render(<App />);
    await waitReady();
    goTo("Versions");
    const steps = screen.getByRole("list", { name: "Setup progress" });
    expect(within(steps).getByText("Account")).toBeTruthy();
    expect(within(steps).getByText("Java")).toBeTruthy();
    expect(within(steps).getByText("Game files")).toBeTruthy();
    expect(within(steps).getAllByText("✓")).toHaveLength(3);
  });

  it("starts with the game files still to do when they are missing", async () => {
    render(<App />);
    await waitReady();
    goTo("Versions");
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
    await waitFor(() => expect(mocked.installJava).toHaveBeenCalledTimes(1));
  });

  it("lets the player pick the Minecraft version and the loader", async () => {
    ready();
    render(<App />);
    await waitReady();
    goTo("Versions");
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
    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeTruthy();
  });

  it("plays offline without any Microsoft sign-in", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await loaded();
    goTo("Versions");
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
    goTo("Versions");
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
    goTo("Versions");
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Steve_01" } });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.stringContaining("java"), "offline", "Steve_01", "1.21.11", "fabric"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Stop Minecraft" }));
    expect(mocked.stopGame).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(gameExitHandler).not.toBeNull());
    act(() => gameExitHandler?.({ code: 0, logPath: "C:\\log.txt", stopped: false, crash: null }));
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
    goTo("Versions");
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

  it("can be read again from About", async () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Cirrus Client license" })).toBeNull();
    goToAbout();
    fireEvent.click(await screen.findByRole("button", { name: "Read the license" }));
    const dialog = await screen.findByRole("dialog", { name: "Cirrus Client license" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Cirrus Client license" })).toBeNull();
  });
});

describe("Modpacks", () => {
  const pvp = { id: "p-pvp", name: "PvP", minecraft: "1.21.11", fabric: true, color: 0 };
  const ready = () => mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
  const chooseOffline = () => fireEvent.click(screen.getByRole("radio", { name: "Offline name" }));

  it("creates a profile from a name, version and loader", async () => {
    mocked.createProfile.mockResolvedValue(pvp);
    render(<App />);
    goTo("Modpacks");
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
    await settled();
    goTo("Modpacks");
    expect(await screen.findByText("1.21.11 Fabric")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play profile PvP" }));
    expect(await screen.findByText("Profile:")).toBeTruthy();
    chooseOffline();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Alex" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(expect.any(String), "offline", "Alex", "1.21.11", "fabric", "p-pvp"),
    );
  });

  it("deletes a profile only after a second click", async () => {
    mocked.listProfiles.mockResolvedValue([pvp]);
    mocked.deleteProfile.mockResolvedValue(undefined);
    render(<App />);
    goTo("Modpacks");
    fireEvent.click(await screen.findByRole("button", { name: "Delete profile PvP" }));
    expect(mocked.deleteProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete PvP" }));
    await waitFor(() => expect(mocked.deleteProfile).toHaveBeenCalledWith("p-pvp"));
  });
});

describe("Themes", () => {
  it("offers only a dark and a light appearance, applies it at once and remembers it", async () => {
    initTheme();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    await goToSettings("Appearance");
    expect(screen.getAllByRole("radio", { name: /theme$/ })).toHaveLength(2);
    fireEvent.click(await screen.findByRole("radio", { name: "Light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("unlimited.theme")).toBe("light");
    expect(screen.getByRole("radio", { name: "Light theme" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to dark when an old theme name is stored", async () => {
    window.localStorage.setItem("unlimited.theme", "ocean");
    initTheme();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("offers the Discord community from Settings", async () => {
    render(<App />);
    goTo("Settings");
    fireEvent.click(await screen.findByRole("button", { name: "Join the Discord community" }));
    expect(mocked.openCommunity).toHaveBeenCalledTimes(1);
  });
});

describe("Installed versions", () => {
  it("says when nothing is installed yet", async () => {
    render(<App />);
    goTo("Versions");
    expect(await screen.findByText("Nothing installed yet")).toBeTruthy();
  });

  it("lists installed setups and picks one for playing", async () => {
    mocked.listInstances.mockResolvedValue([
      { minecraft: "1.21.11", loader: "0.17.0", modCount: 3 },
      { minecraft: "1.20.6", loader: null, modCount: 0 },
    ]);
    render(<App />);
    goTo("Versions");
    expect(await screen.findByText("Loader 0.17.0 · 3 mods")).toBeTruthy();
    expect(screen.getAllByText("Vanilla").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Play Minecraft 1.20.6 vanilla" }));
    expect(await screen.findByLabelText("Minecraft version")).toBeTruthy(); // stays on Play, with the choice applied
    expect((screen.getByLabelText("Minecraft version") as HTMLSelectElement).value).toBe("1.20.6");
    expect(window.localStorage.getItem("unlimited.loader")).toBe("vanilla");
  });
});

describe("Launch log and crash details", () => {
  const crash = {
    hint: "Minecraft ran out of memory. Give it more in Settings > Memory and RAM.",
    report: "---- Minecraft Crash Report ----\njava.lang.OutOfMemoryError: Java heap space\n",
    reportPath: "C:\\game\\crash-reports\\crash-1.txt",
    logTail: "[main/INFO]: Loading\n[main/ERROR]: Out of memory\n",
  };
  const start = async () => {
    mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: "C:\\game\\logs\\cirrus-launch.log" });
    render(<App />);
    await loaded();
    await screen.findAllByText("Steve");
    fireEvent.click(await screen.findByRole("button", { name: "Play" }));
    await waitFor(() => expect(mocked.launchGame).toHaveBeenCalled());
    await waitFor(() => expect(gameExitHandler).not.toBeNull());
  };

  it("shows what Minecraft prints while it starts, and can copy it", async () => {
    mocked.readGameLog.mockResolvedValue({ text: "[main/INFO]: Loading Minecraft 1.21.11\n", offset: 40 });
    await start();
    fireEvent.click(await screen.findByRole("button", { name: "View log" }));
    const dialog = await screen.findByRole("dialog", { name: "Launch log" });
    expect(await within(dialog).findByText(/Loading Minecraft 1.21.11/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy log" }));
    expect(await within(dialog).findByRole("button", { name: /Copied/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Open logs folder" }));
    expect(mocked.openGameFolder).toHaveBeenCalledWith("logs");
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop Minecraft" }));
    expect(mocked.stopGame).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Launch log" })).toBeNull();
  });

  it("opens the crash details by itself when the game crashes", async () => {
    await start();
    act(() => gameExitHandler?.({ code: 1, logPath: "x", stopped: false, crash }));
    const dialog = await screen.findByRole("dialog", { name: "Minecraft crashed" });
    expect(within(dialog).getByText("Minecraft closed unexpectedly")).toBeTruthy();
    expect(within(dialog).getByText(/ran out of memory/)).toBeTruthy();
    expect(within(dialog).getByLabelText("Crash report text").textContent).toContain("OutOfMemoryError");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Game log" }));
    expect(within(dialog).getByLabelText("Game log text").textContent).toContain("Out of memory");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Crash report" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Open crash folder" }));
    expect(mocked.openGameFolder).toHaveBeenCalledWith("crash-reports");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Minecraft crashed" })).toBeNull();
    // The page keeps a way back to the details.
    expect(screen.getByRole("button", { name: "Crash details" })).toBeTruthy();
  });

  it("does not call it a crash when the person pressed Stop", async () => {
    await start();
    act(() => gameExitHandler?.({ code: 1, logPath: "x", stopped: true, crash: null }));
    expect(await screen.findByText("You stopped Minecraft.")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Minecraft crashed" })).toBeNull();
    expect(screen.getByRole("button", { name: "View log" })).toBeTruthy();
  });
});

describe("Window frame", () => {
  it("draws no window buttons outside the desktop app", async () => {
    render(<App />);
    await settled();
    expect(screen.queryByRole("button", { name: "Close window" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Minimize window" })).toBeNull();
    await goToSettings("Appearance");
    expect(screen.queryByText(/normal Windows title bar/)).toBeNull();
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
  const browse = async () => fireEvent.click((await screen.findAllByRole("button", { name: "Browse mods" }))[0]);

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
    await browse();
    expect(await screen.findByRole("heading", { name: "Sodium" })).toBeTruthy();
    expect(mocked.searchMods).toHaveBeenCalledWith("modrinth", "", "1.21.11", 0);
    expect(screen.getByText("1.5M")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search mods"), { target: { value: "sod" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(mocked.searchMods).toHaveBeenLastCalledWith("modrinth", "sod", "1.21.11", 0));

    const install = await screen.findByRole("button", { name: "Install Sodium" });
    await waitFor(() => expect((install as HTMLButtonElement).disabled).toBe(false));
    mocked.listMods.mockResolvedValue([{ fileName: "sodium.jar", size: 2_097_152 }]);
    fireEvent.click(install);
    await waitFor(() => expect(mocked.installMod).toHaveBeenCalledWith("modrinth", "AANobbMI", "1.21.11"));
    expect(await screen.findByText(/Sodium installed \(2 files/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to my mods" }));
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

  it("switches an installed mod off and on without deleting it", async () => {
    withFabric();
    mocked.listMods.mockResolvedValue([
      { fileName: "lithium.jar", size: 1024, enabled: true },
      { fileName: "sodium.jar.disabled", size: 2048, enabled: false },
    ]);
    mocked.setModEnabled.mockResolvedValue("lithium.jar.disabled");
    render(<App />);
    goTo("Mods");
    fireEvent.click(await screen.findByRole("switch", { name: "Disable lithium.jar" }));
    await waitFor(() => expect(mocked.setModEnabled).toHaveBeenCalledWith("1.21.11", "lithium.jar", false));
    const off = await screen.findByRole("switch", { name: "Enable sodium.jar" });
    expect(off.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(off);
    await waitFor(() => expect(mocked.setModEnabled).toHaveBeenCalledWith("1.21.11", "sodium.jar.disabled", true));
  });

  it("filters installed mods by name and by whether they are on", async () => {
    withFabric();
    mocked.listMods.mockResolvedValue([
      { fileName: "lithium.jar", size: 1024 },
      { fileName: "sodium.jar.disabled", size: 2048, enabled: false },
    ]);
    render(<App />);
    goTo("Mods");
    await screen.findByRole("switch", { name: "Disable lithium.jar" });
    fireEvent.change(screen.getByLabelText("Filter installed mods"), { target: { value: "sod" } });
    expect(screen.queryByRole("switch", { name: "Disable lithium.jar" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Enable sodium.jar" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter installed mods"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("radio", { name: "On" }));
    expect(screen.queryByRole("switch", { name: "Enable sodium.jar" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Disable lithium.jar" })).toBeTruthy();
  });

  it("shows why a mod could not be installed", async () => {
    withFabric();
    mocked.searchMods.mockResolvedValue({ hits: [sodium], total: 1 });
    mocked.installMod.mockRejectedValue(new Error("No version of this mod is available."));
    render(<App />);
    goTo("Mods");
    await browse();
    const install = await screen.findByRole("button", { name: "Install Sodium" });
    await waitFor(() => expect((install as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(install);
    expect(await screen.findByText(/No version of this mod is available/)).toBeTruthy();
  });

  it("says CurseForge needs a key when this build has none", async () => {
    render(<App />);
    goTo("Mods");
    await browse();
    fireEvent.click(await screen.findByRole("tab", { name: "CurseForge" }));
    expect(await screen.findByText(/needs an API key/)).toBeTruthy();
  });

  it("narrows the search by category and can clear the filter", async () => {
    withFabric();
    mocked.searchMods.mockResolvedValue({ hits: [sodium], total: 1 });
    render(<App />);
    goTo("Mods");
    await browse();
    await screen.findByRole("heading", { name: "Sodium" });
    fireEvent.click(screen.getByRole("radio", { name: "Optimization" }));
    await waitFor(() =>
      expect(mocked.searchMods).toHaveBeenLastCalledWith("modrinth", "", "1.21.11", 0, "optimization"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(mocked.searchMods).toHaveBeenLastCalledWith("modrinth", "", "1.21.11", 0));
    expect(screen.getByRole("radio", { name: "All" }).getAttribute("aria-checked")).toBe("true");
  });

  it("starts in the mod manager and lets you go back from browsing", async () => {
    withFabric();
    render(<App />);
    goTo("Mods");
    expect(await screen.findByRole("heading", { level: 1, name: "Mod manager" })).toBeTruthy();
    await browse();
    expect(await screen.findByRole("heading", { level: 1, name: "Browse mods" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to my mods" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Mod manager" })).toBeTruthy();
  });

  it("shows a card with the name, version, author and description read from the mod itself", async () => {
    withFabric();
    mocked.listMods.mockResolvedValue([
      {
        fileName: "sodium-fabric.jar",
        size: 2_097_152,
        enabled: true,
        name: "Sodium",
        version: "0.6.0",
        description: "A modern rendering engine.",
        authors: ["JellySquid"],
        icon: "data:image/png;base64,AAAA",
      },
    ]);
    render(<App />);
    goTo("Mods");
    expect(await screen.findByRole("heading", { level: 3, name: "Sodium" })).toBeTruthy();
    expect(screen.getByText("A modern rendering engine.")).toBeTruthy();
    expect(screen.getByText(/v0\.6\.0/)).toBeTruthy();
    expect(screen.getByText(/JellySquid/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Disable sodium-fabric.jar" })).toBeTruthy();
  });
});

describe("Accounts page", () => {
  it("shows the Microsoft account, offline play and how credentials are kept", async () => {
    render(<App />);
    await goToAccounts();
    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeTruthy();
    expect(screen.getByText("Offline play")).toBeTruthy();
    expect(screen.getByText("Switching accounts")).toBeTruthy();
    expect(screen.getByText(/Windows Credential Manager/)).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("shows the signed-in profile and can sign out", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.authSignOut.mockResolvedValue(authStatus({ state: "signedOut", configured: true }));
    render(<App />);
    await settled();
    await goToAccounts();
    expect((await screen.findAllByText("Steve")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: /Sign out/ }));
    await waitFor(() => expect(mocked.authSignOut).toHaveBeenCalledTimes(1));
  });

  it("does not open the account menu on top of the Accounts page", async () => {
    render(<App />);
    await goToAccounts();
    openAccount();
    expect(screen.queryByRole("dialog", { name: "Account" })).toBeNull();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("shows a profile card with the username, a dashed UUID and a way to the Skins page", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    render(<App />);
    await settled();
    await goToAccounts();
    expect((await screen.findAllByText("01234567-89ab-cdef-0123-456789abcdef")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Change skin" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Skins" })).toBeTruthy();
  });
});

describe("Skins page", () => {
  const skin = (extra: Partial<import("../src/api/types").SkinEntry> = {}): import("../src/api/types").SkinEntry => ({
    id: "alex",
    name: "Alex",
    model: "classic",
    source: "file",
    dataUrl: "data:image/png;base64,AAAA",
    ...extra,
  });
  const signedIn = () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
  };

  it("shows an empty state when the library has no skins", async () => {
    render(<App />);
    goTo("Skins");
    expect(await screen.findByRole("heading", { level: 2, name: "No skins yet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose file" })).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("adds a skin from a username and a link", async () => {
    mocked.addSkinPlayer.mockResolvedValue(skin({ id: "notch", name: "Notch", source: "player:Notch" }));
    mocked.addSkinUrl.mockResolvedValue(skin({ id: "link", name: "Skin from a link", source: "url" }));
    render(<App />);
    goTo("Skins");
    const input = await screen.findByLabelText("Username or skin link");
    fireEvent.change(input, { target: { value: "Notch" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(mocked.addSkinPlayer).toHaveBeenCalledWith("Notch"));
    expect(await screen.findByText(/Added “Notch”/)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Slim for new skins" }));
    fireEvent.change(screen.getByLabelText("Username or skin link"), {
      target: { value: "https://textures.minecraft.net/texture/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(mocked.addSkinUrl).toHaveBeenCalledWith("https://textures.minecraft.net/texture/abc", "Skin from a link", "slim"),
    );
  });

  it("asks for something to add when the box is empty", async () => {
    render(<App />);
    goTo("Skins");
    await screen.findByLabelText("Username or skin link");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Enter a Minecraft username or a skin link first/)).toBeTruthy();
    expect(mocked.addSkinPlayer).not.toHaveBeenCalled();
  });

  it("lists saved skins, changes the type and removes one after a second click", async () => {
    mocked.listSkins.mockResolvedValue([skin(), skin({ id: "bob", name: "Bob", model: "slim" })]);
    mocked.setSkinModel.mockResolvedValue(skin({ model: "slim" }));
    mocked.removeSkin.mockResolvedValue(undefined);
    render(<App />);
    goTo("Skins");
    expect(await screen.findByRole("button", { name: "Select Alex" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select Bob" }));
    expect(screen.getByRole("button", { name: "Select Bob" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Select Alex" }));
    const types = screen.getByRole("radiogroup", { name: "Skin type" });
    fireEvent.click(within(types).getByRole("radio", { name: "Slim" }));
    await waitFor(() => expect(mocked.setSkinModel).toHaveBeenCalledWith("alex", "slim"));

    fireEvent.click(screen.getByRole("button", { name: "Remove Alex" }));
    expect(mocked.removeSkin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removing Alex" }));
    await waitFor(() => expect(mocked.removeSkin).toHaveBeenCalledWith("alex"));
  });

  it("will not apply a skin while signed out, and says why", async () => {
    mocked.listSkins.mockResolvedValue([skin()]);
    render(<App />);
    goTo("Skins");
    const apply = await screen.findByRole("button", { name: "Apply to my account" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Sign in with Microsoft to change your account's skin/)).toBeTruthy();
  });

  it("applies the chosen skin to a signed-in account and marks it in use", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([skin()]);
    mocked.applySkin.mockResolvedValue(undefined);
    render(<App />);
    await settled();
    goTo("Skins");
    const apply = await screen.findByRole("button", { name: "Apply to my account" });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    await waitFor(() => expect(mocked.applySkin).toHaveBeenCalledWith("alex"));
    expect(await screen.findByText("In use")).toBeTruthy();
    expect(window.localStorage.getItem("cirrus.appliedSkin")).toBe("alex");
  });

  it("shows why a skin could not be applied", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([skin()]);
    mocked.applySkin.mockRejectedValue(new Error("Minecraft rejected the skin."));
    render(<App />);
    await settled();
    goTo("Skins");
    const apply = await screen.findByRole("button", { name: "Apply to my account" });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    expect(await screen.findByText(/Minecraft rejected the skin/)).toBeTruthy();
  });
});

describe("About page", () => {
  it("shows the version, the tagline and the links, and opens Discord and GitHub", async () => {
    render(<App />);
    goToAbout();
    expect(await screen.findByText(/Version 0\.1\.0/)).toBeTruthy();
    expect(screen.getByText("The sky is the limit.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Discord" }));
    expect(mocked.openCommunity).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open GitHub" }));
    expect(mocked.openGithub).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("opens the license from About", async () => {
    render(<App />);
    goToAbout();
    fireEvent.click(await screen.findByRole("button", { name: "Read the license" }));
    expect(await screen.findByRole("dialog", { name: "Cirrus Client license" })).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("shows an error when a link cannot be opened", async () => {
    mocked.openGithub.mockRejectedValue(new Error("no browser"));
    render(<App />);
    goToAbout();
    fireEvent.click(await screen.findByRole("button", { name: "Open GitHub" }));
    expect(await screen.findByText("no browser")).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });
});

describe("Versions page", () => {
  it("shows the launch panel, launch configuration, profiles and installed versions", async () => {
    render(<App />);
    goTo("Versions");
    expect(await screen.findByRole("heading", { level: 1, name: "Versions" })).toBeTruthy();
    expect(screen.getByLabelText("Minecraft version")).toBeTruthy();
    expect(await screen.findByText("Launch configuration")).toBeTruthy();
    expect(await screen.findByText("Nothing installed yet")).toBeTruthy();
  });

  it("changes the game memory from the launch configuration and saves it", async () => {
    mocked.saveSettings.mockResolvedValue({ ok: true, errors: [], state: settingsState({ memoryMb: 6144 }) });
    render(<App />);
    goTo("Versions");
    fireEvent.click(await screen.findByRole("button", { name: "6 GB" }));
    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ memoryMb: 6144 })),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "6 GB" }).getAttribute("aria-pressed")).toBe("true"));
  });

  it("links to the matching Settings section for Java and the game folder", async () => {
    render(<App />);
    goTo("Versions");
    await screen.findByText("Launch configuration");
    const changes = await screen.findAllByRole("button", { name: "Change" });
    fireEvent.click(changes[changes.length - 1]);
    expect((await screen.findByRole("tab", { name: "Game directory" })).getAttribute("aria-selected")).toBe("true");
  });
});

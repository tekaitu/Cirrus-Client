// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";
import { initTheme } from "../src/core/theme";
import { notify, resetNotifications } from "../src/core/notifications";
import { api } from "../src/api/client";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { resetAppearanceCache } from "../src/hooks/useAppearance";
import type { AuthStatus, DeviceCodeInfo, GameExit, GameProgress, GameStatus, InstanceView, InstallProgress, InstallResult } from "../src/api/types";
import { appInfo, java17Raw, java21Raw, settingsState, systemInfo } from "./helpers/fixtures";

vi.mock("../src/api/client", () => ({
  api: {
    getAppInfo: vi.fn(),
    gameStatus: vi.fn(),
    listInstances: vi.fn(),
    listInstanceViews: vi.fn(),
    saveInstance: vi.fn(),
    cloneInstance: vi.fn(),
    deleteInstance: vi.fn(),
    instanceContents: vi.fn(),
    repairInstance: vi.fn(),
    switchFabricLoader: vi.fn(),
    fabricLoaderVersions: vi.fn(),
    openInstanceFolder: vi.fn(),
    diagnoseCrash: vi.fn(),
    checkForUpdates: vi.fn(),
    openUpdatePage: vi.fn(),
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
    authSwitch: vi.fn(),
    authSignOut: vi.fn(),
    openMicrosoftLink: vi.fn(),
    onAuthDeviceCode: vi.fn(),
    playerAppearance: vi.fn(),
    listVersionCatalog: vi.fn(),
    onJavaInstallProgress: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
  },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const mocked = vi.mocked(api);

/** Opens the version catalogue from the library (its Add Version button). */
function openAddVersion() {
  fireEvent.click(screen.getByRole("button", { name: "Add Version" }));
}

function goTo(name: "Home" | "Versions" | "Library" | "Browse" | "Modpacks" | "Mods" | "Character" | "Servers" | "Settings") {
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
  accounts: [],
  activeId: null,
  ...extra,
});
const steve = { id: "0123456789abcdef0123456789abcdef", name: "Steve", ownsMinecraft: true };
const alex = { id: "fedcba9876543210fedcba9876543210", name: "Alex" };
const appearance = (extra: Partial<import("../src/api/types").PlayerAppearance> = {}) => ({
  id: steve.id,
  name: steve.name,
  model: "classic" as const,
  skin: "data:image/png;base64,AAAA",
  cape: null,
  ...extra,
});

const instanceView = (extra: Partial<InstanceView> = {}): InstanceView => ({
  id: "inst-1",
  minecraft: "1.21.11",
  loader: "fabric",
  loaderVersion: "0.17.0",
  name: "Fabric 1.21.11",
  icon: 0,
  javaPath: null,
  memoryMb: null,
  gameDir: "C:\\Users\\player\\AppData\\Roaming\\com.limitedfps.app\\game",
  customGameDir: false,
  jvmArgs: "",
  lastPlayed: 0,
  modCount: 0,
  javaMajor: 21,
  clonedFrom: null,
  ...extra,
});

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
  resetAppearanceCache();
  window.localStorage.clear();
  window.localStorage.setItem("unlimited.license", "2");
  mocked.listGameVersions.mockResolvedValue(["1.21.11", "1.21.1", "1.20.6"]);
  mocked.listVersionCatalog.mockResolvedValue([
    { id: "1.21.11", kind: "release", released: null, supported: true },
    { id: "1.21.1", kind: "release", released: null, supported: true },
    { id: "1.20.6", kind: "release", released: null, supported: true },
  ]);
  mocked.curseforgeAvailable.mockResolvedValue(false);
  mocked.listMods.mockResolvedValue([]);
  mocked.listInstances.mockResolvedValue([]);
  mocked.listInstanceViews.mockResolvedValue([]);
  mocked.saveInstance.mockResolvedValue({} as never);
  mocked.deleteInstance.mockResolvedValue(undefined);
  mocked.cloneInstance.mockResolvedValue({} as never);
  mocked.repairInstance.mockResolvedValue({ status: "installed", message: null, loader: "0.17.0" });
  mocked.diagnoseCrash.mockResolvedValue({
    cause: "Minecraft ran out of memory. Give it more in the instance's memory setting.",
    confidence: "high",
    evidence: ["java.lang.OutOfMemoryError: Java heap space"],
    fixes: [
      {
        kind: "memory",
        label: "Raise the memory limit",
        detail: "Give this instance 4096 MB instead of the current limit.",
        value: "4096",
        changesSettings: true,
      },
    ],
    excerpt: "java.lang.OutOfMemoryError: Java heap space",
    unknown: false,
  });
  mocked.fabricLoaderVersions.mockResolvedValue([
    { version: "0.17.0", stable: true, minecraft: "1.21.11" },
    { version: "0.16.9", stable: true, minecraft: "1.21.11" },
  ]);
  mocked.openInstanceFolder.mockResolvedValue(undefined);
  mocked.instanceContents.mockResolvedValue({ worlds: 0, screenshots: 0, mods: 0, resourcePacks: 0 });
  mocked.checkForUpdates.mockResolvedValue({
    current: "0.3.3",
    latest: "0.3.3",
    available: false,
    notes: "",
    pageUrl: null,
    downloadUrl: null,
    publishedAt: null,
    installReady: false,
    installMessage: "",
  });
  mocked.listProfiles.mockResolvedValue([]);
  mocked.openCommunity.mockResolvedValue(undefined);
  mocked.openGithub.mockResolvedValue(undefined);
  mocked.listSkins.mockResolvedValue([]);
  mocked.discordSetPresence.mockResolvedValue("ok");
  mocked.readGameLog.mockResolvedValue({ text: "", offset: 0 });
  mocked.openGameFolder.mockResolvedValue(undefined);
  mocked.discordClearPresence.mockResolvedValue(undefined);
  mocked.playerSkin.mockResolvedValue(null);
  mocked.playerAppearance.mockResolvedValue(appearance());
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
  it("shows the branded hero, the Play button and the launcher's own sections", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Sky is the limit." })).toBeTruthy();
    expect(screen.getByText(/Minecraft 1\.21\.11 · Fabric/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Sign in to play" })).toBeTruthy();
    // The version is secondary information now, not the headline.
    expect(screen.queryByRole("heading", { level: 1, name: /1\.21\.11\s+Fabric/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Recently played" })).toBeTruthy();
    expect(screen.getByText("Nothing played yet")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /In Cirrus/ })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Shortcuts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a version" })).toBeTruthy();
  });

  it("has a top bar with the page tabs, a bell, Settings and the account", async () => {
    render(<App />);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Home", "Versions", "Browse", "Mods", "Modpacks", "Character", "Servers"]) {
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
    expect(await screen.findByRole("heading", { level: 1, name: "Character" })).toBeTruthy();
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
    const bell = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(bell).getByText("Sodium installed")).toBeTruthy();
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

  it("offers Microsoft sign-in with its own branding and never exposes an app ID", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    render(<App />);
    openAccount();
    expect((await screen.findAllByText("Not signed in")).length).toBeGreaterThan(0);
    const button = await screen.findByRole("button", { name: "Sign in with Microsoft" });
    expect(button.querySelector("img")).toBeTruthy();
    expect(screen.queryByLabelText("Application (client) ID")).toBeNull();
    expect(screen.queryByLabelText("Azure application (client) ID")).toBeNull();
    expect(screen.queryByRole("button", { name: "Set up sign-in (owner)" })).toBeNull();
    expect(screen.queryByText(/How to get the app ID/)).toBeNull();
  });

  it("switches between saved accounts without signing in again", async () => {
    mocked.authStatus.mockResolvedValue(
      authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve, accounts: [steve, alex], activeId: steve.id }),
    );
    mocked.authSwitch.mockResolvedValue(
      authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: alex, accounts: [alex, steve], activeId: alex.id }),
    );
    render(<App />);
    await settled();
    await goToAccounts();
    fireEvent.click(await screen.findByRole("button", { name: "Switch to Alex" }));
    await waitFor(() => expect(mocked.authSwitch).toHaveBeenCalledWith(alex.id));
    await waitFor(() => expect(mocked.playerAppearance).toHaveBeenCalledWith(alex.id, false));
    expect(await screen.findByRole("button", { name: "Switch to Steve" })).toBeTruthy();
  });

  it("signs in with a device code and shows the real profile", async () => {
    mocked.authStatus.mockResolvedValue(configured());
    let finish: (s: AuthStatus) => void = () => {};
    mocked.authSignIn.mockReturnValue(new Promise<AuthStatus>((resolve) => (finish = resolve)));
    mocked.openMicrosoftLink.mockResolvedValue(undefined);
    render(<App />);
    openAccount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with a code instead" }));
    expect(await screen.findByText("Contacting Microsoft…")).toBeTruthy();

    await waitFor(() => expect(codeHandler).not.toBeNull());
    act(() => codeHandler?.({ userCode: "ABCD1234", verificationUri: "https://www.microsoft.com/link", expiresIn: 900 }));
    expect(await screen.findByText("ABCD1234")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Microsoft page" }));
    expect(mocked.openMicrosoftLink).toHaveBeenCalledWith("https://www.microsoft.com/link");

    await act(async () => finish(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve })));
    expect(await screen.findAllByText("Steve")).toBeTruthy();
    expect(document.querySelector(".account-card .skin-head")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Microsoft account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with a code instead" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with a code instead" }));
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
    expect((await screen.findAllByText(/expired or was revoked/)).length).toBeGreaterThan(0);
  });

  it("keeps Microsoft sign-in configuration out of Settings", async () => {
    render(<App />);
    await goToSettings("General");
    expect(screen.queryByLabelText(/Azure application \(client\) ID/)).toBeNull();
    expect(screen.queryByText("Developer options")).toBeNull();
    expect(screen.queryByText("Microsoft sign-in app")).toBeNull();
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
    expect(screen.getByText("Go to Character")).toBeTruthy();
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
  /** Sets offline play and its name where they live now: Settings › Launch settings. */
  const playOfflineAs = async (name: string) => {
    await goToSettings("Launch settings");
    fireEvent.click(await screen.findByRole("radio", { name: "Offline name" }));
    fireEvent.change(screen.getByLabelText("Offline player name"), { target: { value: name } });
    goTo("Home");
  };
  beforeEach(() => owned());

  it("shows the chosen version and loader under the branded headline", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Sky is the limit." })).toBeTruthy();
    expect(screen.getByText(/Minecraft 1\.21\.11 · Fabric · no instance selected/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the Library" })).toBeTruthy();
    await settled();
  });

  it("lists recently played instances newest first and selects one", async () => {
    mocked.listInstanceViews.mockResolvedValue([
      instanceView({ id: "a", name: "PvP", lastPlayed: 1_700_000_000_000 }),
      instanceView({
        id: "b",
        name: "Building",
        minecraft: "1.20.6",
        loader: "vanilla",
        loaderVersion: null,
        lastPlayed: 1_600_000_000_000,
      }),
    ]);
    ready();
    render(<App />);
    await loaded();
    const recent = await screen.findByRole("region", { name: "Recently played" });
    const cards = within(recent).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toContain("PvP");
    expect(cards[1]!.textContent).toContain("Building");
    fireEvent.click(within(cards[0]!).getByRole("button", { name: /Select & play/ }));
    expect(window.localStorage.getItem("unlimited.instance")).toBe("a");
    expect((await screen.findAllByText(/Minecraft 1\.21\.11 · Fabric/)).length).toBeGreaterThan(0);
  });

  it("sets everything up in one click: downloads the game, then starts it", async () => {
    mocked.installGame.mockImplementation(async () => {
      mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
      return { status: "installed", message: null, loader: "0.17.0" };
    });
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    await waitFor(() => expect(mocked.installGame).toHaveBeenCalledWith("1.21.11", "fabric", null));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(
        expect.stringContaining("java"),
        "microsoft",
        null,
        "1.21.11",
        "fabric",
        undefined,
        undefined,
      ),
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
    expect((await screen.findAllByText("Game files could not be downloaded")).length).toBeGreaterThan(0);
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

  it("opens the side account panel with both ways to play when nobody is signed in", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true }));
    ready();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to play" }));
    const panel = await screen.findByRole("dialog", { name: "Account" });
    expect(within(panel).getByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
    expect(within(panel).getByLabelText("Cracked username")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Use this name" })).toBeTruthy();
  });

  it("plays as a cracked username chosen in the account panel, straight from Home", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true }));
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await loaded();
    openAccount();
    fireEvent.change(await screen.findByLabelText("Cracked username"), { target: { value: "Herobrine" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this name" }));
    expect(window.localStorage.getItem("unlimited.username")).toBe("Herobrine");
    expect(window.localStorage.getItem("unlimited.playMode")).toBe("offline");
    expect((await screen.findAllByText("Herobrine")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close account panel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(
        expect.any(String),
        "offline",
        "Herobrine",
        "1.21.11",
        "fabric",
        undefined,
        undefined,
      ),
    );
  });

  it("refuses a cracked username Minecraft would refuse", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    render(<App />);
    openAccount();
    const field = await screen.findByLabelText("Cracked username");
    fireEvent.change(field, { target: { value: "a" } });
    expect((screen.getByRole("button", { name: "Use this name" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/3 to 16 characters/)).toBeTruthy();
  });

  it("plays offline without any Microsoft sign-in", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await loaded();
    await playOfflineAs("Alex");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(
        expect.any(String),
        "offline",
        "Alex",
        "1.21.11",
        "fabric",
        undefined,
        undefined,
      ),
    );
  });

  it("validates the offline player name before Play is allowed", async () => {
    ready();
    render(<App />);
    await waitReady();
    await playOfflineAs("bad name");
    const play = screen.getByRole("button", { name: "Play" }) as HTMLButtonElement;
    expect(play.disabled).toBe(true);
    expect(screen.getByText(/Choose a valid player name first/)).toBeTruthy();
    await playOfflineAs("Steve_01");
    expect((screen.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("launches offline with the chosen name, version and loader, then shows the running state", async () => {
    ready();
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: "C:\\log.txt" });
    render(<App />);
    await waitReady();
    await playOfflineAs("Steve_01");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(mocked.launchGame).toHaveBeenCalledWith(
        expect.stringContaining("java"),
        "offline",
        "Steve_01",
        "1.21.11",
        "fabric",
        undefined,
        undefined,
      ),
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
      expect(mocked.launchGame).toHaveBeenCalledWith(
        expect.any(String),
        "microsoft",
        null,
        "1.21.11",
        "fabric",
        undefined,
        undefined,
      ),
    );
  });

  it("shows the reason when Minecraft cannot start", async () => {
    ready();
    mocked.launchGame.mockResolvedValue({ started: false, message: "A game file is missing.", logPath: null });
    render(<App />);
    await waitReady();
    await playOfflineAs("Steve");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect((await screen.findAllByText("Minecraft could not be started")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("A game file is missing.")).length).toBeGreaterThan(0);
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
  it("lists instances as setups and sends one to its mods", async () => {
    mocked.listInstanceViews.mockResolvedValue([
      instanceView({ id: "a", name: "PvP", modCount: 3 }),
      instanceView({ id: "b", name: "Building", minecraft: "1.20.6", loader: "vanilla", loaderVersion: null }),
    ]);
    render(<App />);
    await settled();
    goTo("Modpacks");
    expect(await screen.findByRole("heading", { level: 1, name: "Modpacks" })).toBeTruthy();
    const pvp = (await screen.findByText("PvP")).closest("li")!;
    expect(pvp.textContent).toContain("Minecraft 1.21.11 · 3 mods");
    fireEvent.click(within(pvp).getByRole("button", { name: "Mods" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Mod manager" })).toBeTruthy();
    expect(window.localStorage.getItem("unlimited.instance")).toBe("a");
  });

  it("can show only the setups that have mods", async () => {
    mocked.listInstanceViews.mockResolvedValue([
      instanceView({ id: "a", name: "PvP", modCount: 3 }),
      instanceView({ id: "b", name: "Building", minecraft: "1.20.6", loader: "vanilla", loaderVersion: null }),
    ]);
    render(<App />);
    await settled();
    goTo("Modpacks");
    await screen.findByText("PvP");
    fireEvent.click(screen.getByRole("radio", { name: "With mods" }));
    expect(screen.getByText("PvP")).toBeTruthy();
    expect(screen.queryByText("Building")).toBeNull();
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

describe("Library", () => {
  it("says when nothing is installed and points at the version list", async () => {
    render(<App />);
    goTo("Library");
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeTruthy();
    expect(await screen.findByText("Your library is empty")).toBeTruthy();
    openAddVersion();
    expect(await screen.findByRole("heading", { level: 1, name: "Versions" })).toBeTruthy();
  });

  it("lists installed instances, selects one and opens its folder", async () => {
    mocked.listInstanceViews.mockResolvedValue([
      instanceView({ id: "a", name: "PvP", modCount: 3, lastPlayed: 1_700_000_000_000 }),
      instanceView({ id: "b", name: "Building", minecraft: "1.20.6", loader: "vanilla", loaderVersion: null }),
    ]);
    mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    await settled();
    goTo("Library");
    expect(await screen.findByRole("heading", { level: 2, name: "PvP" })).toBeTruthy();
    expect(screen.getByText(/3 mods/)).toBeTruthy();
    expect(screen.getByText("Building")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open folder for Building" }));
    await waitFor(() => expect(mocked.openInstanceFolder).toHaveBeenCalledWith("b"));
    const rows = screen.getAllByRole("listitem");
    const building = rows.find((r) => r.textContent?.includes("Building"))!;
    fireEvent.click(within(building).getByRole("button", { name: "Play" }));
    await waitFor(() => expect(window.localStorage.getItem("unlimited.instance")).toBe("b"));
  });

  it("keeps deletion behind a confirmation and names what its folder holds", async () => {
    mocked.listInstanceViews.mockResolvedValue([instanceView({ id: "a", name: "PvP" })]);
    mocked.instanceContents.mockResolvedValue({ worlds: 2, screenshots: 1, mods: 1, resourcePacks: 0 });
    render(<App />);
    await settled();
    goTo("Library");
    fireEvent.click(await screen.findByRole("button", { name: "Settings for PvP" }));
    const dialog = await screen.findByRole("dialog", { name: "PvP settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(mocked.deleteInstance).not.toHaveBeenCalled();
    expect(await within(dialog).findByText(/this removes 2 worlds, 1 mod, 1 screenshot/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete instance" }));
    await waitFor(() => expect(mocked.deleteInstance).toHaveBeenCalledWith("a", false));
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

  it("shows the username, UUID, ownership and skin, and links to the Character page", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    render(<App />);
    await settled();
    await goToAccounts();
    expect((await screen.findAllByText("Steve")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("01234567-89ab-cdef-0123-456789abcdef").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Minecraft: Java Edition owned").length).toBeGreaterThan(0);
    expect(screen.getByText("MINECRAFT: JAVA EDITION")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change skin" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Character" })).toBeTruthy();
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
    goTo("Character");
    expect(await screen.findByRole("heading", { level: 2, name: "No skins yet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose a PNG file/ })).toBeTruthy();
    await waitFor(() => expect(mocked.detectJava).toHaveBeenCalled());
  });

  it("adds a skin from a username and a link", async () => {
    mocked.addSkinPlayer.mockResolvedValue(skin({ id: "notch", name: "Notch", source: "player:Notch" }));
    mocked.addSkinUrl.mockResolvedValue(skin({ id: "link", name: "Skin from a link", source: "url" }));
    render(<App />);
    goTo("Character");
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
    goTo("Character");
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
    goTo("Character");
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
    goTo("Character");
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
    goTo("Character");
    const apply = await screen.findByRole("button", { name: "Apply to my account" });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    await waitFor(() => expect(mocked.applySkin).toHaveBeenCalledWith("alex"));
    expect(await screen.findByText("In use")).toBeTruthy();
    expect(window.localStorage.getItem("cirrus.appliedSkin")).toBe("alex");
  });

  it("shows an honest empty state when the account has no cape", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([]);
    render(<App />);
    await settled();
    goTo("Character");
    expect(await screen.findByText("No cape equipped")).toBeTruthy();
    expect(screen.getByText(/Capes can only be equipped on minecraft.net/)).toBeTruthy();
    expect(screen.queryByText(/Cirrus Cloud/)).toBeNull();
  });

  it("shows the cape the account actually has equipped and adds no cosmetics", async () => {
    signedIn();
    mocked.playerAppearance.mockResolvedValue(appearance({ cape: "data:image/png;base64,CCCC" }));
    mocked.listSkins.mockResolvedValue([]);
    render(<App />);
    await settled();
    goTo("Character");
    expect(await screen.findByText("Equipped and synced")).toBeTruthy();
    expect(screen.getByText("Account cape")).toBeTruthy();
    expect(screen.queryByText(/Cirrus Cloud/)).toBeNull();
    expect(mocked.applySkin).not.toHaveBeenCalled();
  });

  it("uploads a PNG to the library and applies it to the account", async () => {
    signedIn();
    const uploaded = skin({ id: "hero", name: "hero" });
    mocked.listSkins.mockResolvedValueOnce([]).mockResolvedValue([uploaded]);
    mocked.addSkinFile.mockResolvedValue(uploaded);
    mocked.applySkin.mockResolvedValue(undefined);
    render(<App />);
    await settled();
    goTo("Character");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "hero.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Skin file"), { target: { files: [file] } });
    await waitFor(() => expect(mocked.addSkinFile).toHaveBeenCalledTimes(1));
    const [name, model] = mocked.addSkinFile.mock.calls[0]!;
    expect(name).toBe("hero");
    expect(model).toBe("classic");
    fireEvent.click(await screen.findByRole("button", { name: "Apply to my account" }));
    await waitFor(() => expect(mocked.applySkin).toHaveBeenCalledWith("hero"));
  });

  it("zooms the character preview without touching the account", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([skin()]);
    render(<App />);
    await settled();
    goTo("Character");
    const zoomIn = await screen.findByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(screen.getByText("118%")).toBeTruthy();
    fireEvent.click(zoomOut);
    expect(screen.getByText("109%")).toBeTruthy();
    expect(mocked.applySkin).not.toHaveBeenCalled();
  });

  it("restores the skin that was in use before the last change", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([
      skin({ id: "alex", name: "Alex" }),
      skin({ id: "bob", name: "Bob" }),
    ]);
    mocked.applySkin.mockResolvedValue(undefined);
    window.localStorage.setItem("cirrus.appliedSkin", "bob");
    window.localStorage.setItem("cirrus.previousSkin", "alex");
    render(<App />);
    await settled();
    goTo("Character");
    const restore = await screen.findByRole("button", { name: "Restore previous skin" });
    fireEvent.click(restore);
    await waitFor(() => expect(mocked.applySkin).toHaveBeenCalledWith("alex"));
    expect(await screen.findByText("Restored “Alex”.")).toBeTruthy();
  });

  it("shows why a skin could not be applied", async () => {
    signedIn();
    mocked.listSkins.mockResolvedValue([skin()]);
    mocked.applySkin.mockRejectedValue(new Error("Minecraft rejected the skin."));
    render(<App />);
    await settled();
    goTo("Character");
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

describe("Versions", () => {
  const catalog = () => {
    mocked.listVersionCatalog.mockResolvedValue([
      { id: "1.21.11", kind: "release", released: "2025-12-02T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.21.1", kind: "release", released: "2024-08-08T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.20.6", kind: "release", released: "2024-04-29T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.12.2", kind: "release", released: "2017-09-18T10:00:00+00:00", supported: true, javaMajor: 8 },
      { id: "25w45a", kind: "snapshot", released: "2025-11-05T10:00:00+00:00", supported: false, javaMajor: 21 },
    ]);
  };
  const expand = async (title: RegExp) => {
    const head = await screen.findByRole("button", { name: title });
    fireEvent.click(head);
    return head;
  };

  it("groups releases into families with their own artwork instead of one list", async () => {
    catalog();
    render(<App />);
    goTo("Versions");
    expect(await screen.findByRole("heading", { level: 1, name: "Versions" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Minecraft 1\.21/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Minecraft 1\.12/ })).toBeTruthy();
    const art = Array.from(document.querySelectorAll("img.family-art")).map((img) => img.getAttribute("src"));
    expect(new Set(art).size).toBeGreaterThan(1);
    // Snapshots are counted but never offered as an install in this build.
    expect(screen.getByText(/snapshots are listed by Mojang but cannot be installed/)).toBeTruthy();
    expect(screen.queryByText("25w45a")).toBeNull();
  });

  it("expands a family into its individual releases, newest first", async () => {
    catalog();
    render(<App />);
    goTo("Versions");
    await expand(/Minecraft 1\.21/);
    expect(screen.getByText("Minecraft 1.21.11")).toBeTruthy();
    expect(screen.getByText("Minecraft 1.21.1")).toBeTruthy();
    const rows = screen.getAllByText(/^Minecraft 1\.21\./);
    expect(rows[0]!.textContent).toContain("1.21.11");
    fireEvent.change(screen.getByLabelText("Order versions"), { target: { value: "oldest" } });
    const oldest = screen.getAllByText(/^Minecraft 1\.21\./);
    expect(oldest[0]!.textContent).toContain("1.21.1");
  });

  it("searches across families and hides what does not match", async () => {
    catalog();
    render(<App />);
    goTo("Versions");
    await screen.findByRole("button", { name: /Minecraft 1\.21/ });
    fireEvent.change(screen.getByLabelText("Search Minecraft versions"), { target: { value: "1.12" } });
    expect(await screen.findByRole("button", { name: /Minecraft 1\.12/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Minecraft 1\.21/ })).toBeNull();
    expect(screen.getByText("Minecraft 1.12.2")).toBeTruthy();
  });

  it("marks versions that already have an instance in the Library", async () => {
    catalog();
    mocked.listInstanceViews.mockResolvedValue([instanceView({ id: "a", minecraft: "1.21.11" })]);
    render(<App />);
    await settled();
    goTo("Versions");
    await expand(/Minecraft 1\.21/);
    expect(screen.getByText("In your Library")).toBeTruthy();
    expect(screen.getByText("1 installed")).toBeTruthy();
  });

  it("offers Vanilla and Fabric with their own marks, and installs the chosen one", async () => {
    catalog();
    mocked.installGame.mockResolvedValue({ status: "installed", message: null, loader: "0.17.0" });
    render(<App />);
    goTo("Versions");
    await expand(/Minecraft 1\.21/);
    const row = screen.getByText("Minecraft 1.21.11").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Install" }));
    const dialog = await screen.findByRole("dialog", { name: "Install Minecraft 1.21.11" });
    expect(within(dialog).getByRole("radio", { name: /^Fabric/ })).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: /^Vanilla/ })).toBeTruthy();
    // OptiFine is explained instead of being offered without a verified installer.
    expect(within(dialog).getByText(/OptiFine/)).toBeTruthy();
    // The recommended Fabric loader is preselected and can be changed before installing.
    expect(await within(dialog).findByRole("combobox")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Vanilla/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Install Vanilla" }));
    await waitFor(() => expect(mocked.installGame).toHaveBeenCalledWith("1.21.11", "vanilla", null));
  });

  it("installs Fabric with the loader version chosen in the dialog", async () => {
    catalog();
    mocked.installGame.mockResolvedValue({ status: "installed", message: null, loader: "0.16.9" });
    render(<App />);
    goTo("Versions");
    await expand(/Minecraft 1\.21/);
    const row = screen.getByText("Minecraft 1.21.11").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Install" }));
    const dialog = await screen.findByRole("dialog", { name: "Install Minecraft 1.21.11" });
    const select = await within(dialog).findByRole("combobox");
    fireEvent.change(select, { target: { value: "0.16.9" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Install Fabric" }));
    await waitFor(() => expect(mocked.installGame).toHaveBeenCalledWith("1.21.11", "fabric", "0.16.9"));
  });
});

describe("Account switching and removal", () => {
  const twoAccounts = () => {
    mocked.authStatus.mockResolvedValue(
      authStatus({
        state: "signedIn",
        configured: true,
        savedLogin: true,
        profile: steve,
        accounts: [steve, alex],
        activeId: steve.id,
      }),
    );
  };

  it("marks the active account and removes another only after a confirmation", async () => {
    twoAccounts();
    mocked.authSignOut.mockResolvedValue(
      authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve, accounts: [steve], activeId: steve.id }),
    );
    render(<App />);
    await settled();
    await goToAccounts();
    expect((await screen.findAllByText("Active account")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Alex" }));
    expect(mocked.authSignOut).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm removing Alex" }));
    await waitFor(() => expect(mocked.authSignOut).toHaveBeenCalledWith(alex.id));
  });

  it("refreshes the skin with a cache-bypassing request", async () => {
    twoAccounts();
    render(<App />);
    await settled();
    await goToAccounts();
    const refresh = await screen.findByRole("button", { name: "Refresh skin" });
    fireEvent.click(refresh);
    await waitFor(() => expect(mocked.playerAppearance).toHaveBeenLastCalledWith(steve.id, true));
  });

  it("refreshes every head when the account skin changes", async () => {
    twoAccounts();
    mocked.playerAppearance
      .mockResolvedValueOnce(appearance({ skin: "data:image/png;base64,OLD" }))
      .mockResolvedValue(appearance({ skin: "data:image/png;base64,NEW" }));
    render(<App />);
    await settled();
    await goToAccounts();
    const headerLayer = () => document.querySelector(".hdr-account .skin-head-layer") as HTMLElement | null;
    await waitFor(() => expect(headerLayer()?.style.backgroundImage).toContain("OLD"));
    fireEvent.click(await screen.findByRole("button", { name: "Refresh skin" }));
    await waitFor(() => expect(headerLayer()?.style.backgroundImage).toContain("NEW"));
  });

  it("draws a clearly labelled default character when the skin cannot be read", async () => {
    twoAccounts();
    mocked.playerAppearance.mockRejectedValue(new Error("The skin service is unavailable."));
    render(<App />);
    await settled();
    await goToAccounts();
    expect(await screen.findByText(/Default look/)).toBeTruthy();
    expect(screen.getByText(/default look is shown instead/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh skin" })).toBeTruthy();
  });

  it("never starts Minecraft twice when Play is pressed twice", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
    mocked.launchGame.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await loaded();
    await screen.findAllByText("Steve");
    const play = await screen.findByRole("button", { name: "Play" });
    fireEvent.click(play);
    fireEvent.click(play);
    await waitFor(() => expect(mocked.launchGame).toHaveBeenCalledTimes(1));
  });
});

describe("Settings sections in 0.3.1", () => {
  it("has an Account section that shows the active account and links to Accounts", async () => {
    mocked.authStatus.mockResolvedValue(
      authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve, accounts: [steve], activeId: steve.id }),
    );
    render(<App />);
    await settled();
    await goToSettings("Account");
    expect(screen.getByRole("heading", { level: 2, name: "Active account" })).toBeTruthy();
    expect(screen.getByText("Microsoft account · connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage accounts" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeTruthy();
  });

  it("saves the game window size and extra JVM options with the other settings", async () => {
    mocked.saveSettings.mockResolvedValue({
      ok: true,
      errors: [],
      state: settingsState({ windowWidth: 1920, windowHeight: 1080, jvmArgs: "-XX:+UseG1GC" }),
    });
    render(<App />);
    await goToSettings("Launch settings");
    fireEvent.change(await screen.findByLabelText("Window width"), { target: { value: "1920" } });
    fireEvent.change(screen.getByLabelText("Window height"), { target: { value: "1080" } });
    fireEvent.click(screen.getByRole("tab", { name: "Performance" }));
    fireEvent.change(await screen.findByLabelText("Extra JVM options"), { target: { value: "-XX:+UseG1GC" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ windowWidth: 1920, windowHeight: 1080, jvmArgs: "-XX:+UseG1GC" }),
      ),
    );
  });

  it("blocks an unusable window size before anything is saved", async () => {
    render(<App />);
    await goToSettings("Launch settings");
    fireEvent.change(await screen.findByLabelText("Window width"), { target: { value: "320" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/Window width must be between/)).toBeTruthy();
    expect(mocked.saveSettings).not.toHaveBeenCalled();
  });

  it("remembers whether the character preview turns on its own", async () => {
    render(<App />);
    await goToSettings("Appearance");
    const spin = (await screen.findByRole("checkbox", { name: /Turn the character preview automatically/ })) as HTMLInputElement;
    expect(spin.checked).toBe(true);
    fireEvent.click(spin);
    expect(window.localStorage.getItem("cirrus.characterSpin")).toBe("off");
  });
});

describe("Download notifications", () => {
  it("confirms a finished download with a toast and in the bell", async () => {
    mocked.authStatus.mockResolvedValue(authStatus({ state: "signedOut", configured: true, savedLogin: true }));
    mocked.authRestore.mockResolvedValue(authStatus({ state: "signedIn", configured: true, savedLogin: true, profile: steve }));
    mocked.installGame.mockImplementation(async () => {
      mocked.gameStatus.mockResolvedValue(gameStatus({ installed: true, loader: "0.17.0" }));
      return { status: "installed", message: null, loader: "0.17.0" };
    });
    mocked.launchGame.mockResolvedValue({ started: true, message: null, logPath: null });
    render(<App />);
    await loaded();
    await screen.findAllByText("Steve");
    fireEvent.click(await screen.findByRole("button", { name: "Set up & play" }));
    expect(await screen.findByText("Game files are ready")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Dismiss notification: Game files are ready" })).toBeTruthy();
  });
});

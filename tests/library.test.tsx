// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ModInspection, PackDetails, PackHit } from "../src/api/types";

vi.mock("../src/api/client", () => ({
  api: {
    inspectModFile: vi.fn(),
    installUploadedMod: vi.fn(),
    searchResourcePacks: vi.fn(),
    resourcePackDetails: vi.fn(),
    installResourcePack: vi.fn(),
    listResourcePacks: vi.fn(),
    setResourcePackEnabled: vi.fn(),
    removeResourcePack: vi.fn(),
    curseforgeAvailable: vi.fn(),
  },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock("../src/core/notifications", () => ({ notify: vi.fn() }));

import { api } from "../src/api/client";
import { ModUpload } from "../src/components/ModUpload";
import { PackBrowser } from "../src/components/PackBrowser";
import { SkinViewer } from "../src/components/SkinViewer";
import { packCache } from "../src/core/packs";

const mocked = vi.mocked(api);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  packCache.clear();
  mocked.curseforgeAvailable.mockResolvedValue(true);
  mocked.searchResourcePacks.mockResolvedValue({ hits: [], total: 0 });
  mocked.listResourcePacks.mockResolvedValue([]);
});

function inspection(over: Partial<ModInspection> = {}): ModInspection {
  return {
    fileName: "Example-1.2.3.jar",
    size: 2 * 1024 * 1024,
    installable: true,
    modId: "example_mod",
    name: "Example",
    version: "1.2.3",
    description: "Does things",
    authors: ["Ana"],
    icon: null,
    minecraft: "1.21.x",
    fabricLoader: ">=0.16",
    java: null,
    dependencies: [],
    duplicateOf: null,
    sameFile: false,
    problems: [],
    ...over,
  };
}

function choose(name: string, content = "bytes") {
  const input = screen.getByLabelText("Mod files") as HTMLInputElement;
  const file = new File([content], name, { type: "application/java-archive" });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe("uploading mods", () => {
  it("refuses a file that is not a jar without asking the backend", async () => {
    render(<ModUpload version="1.21.11" fabricReady onInstalled={vi.fn()} />);
    choose("notes.txt");
    expect(await screen.findByText(/not a \.jar file/)).toBeTruthy();
    expect(mocked.inspectModFile).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Install 0 mods" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows what a chosen jar is, then installs it", async () => {
    mocked.inspectModFile.mockResolvedValue(inspection());
    mocked.installUploadedMod.mockResolvedValue({
      fileName: "Example-1.2.3.jar",
      status: "installed",
      message: "Installed as Example-1.2.3.jar.",
    });
    const onInstalled = vi.fn();
    render(<ModUpload version="1.21.11" fabricReady onInstalled={onInstalled} />);

    choose("Example-1.2.3.jar");
    expect(await screen.findByText("Example")).toBeTruthy();
    expect(screen.getByText("v1.2.3 · example_mod · 2.0 MB · Minecraft 1.21.x")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Install mod" }));
    await waitFor(() => expect(mocked.installUploadedMod).toHaveBeenCalledTimes(1));
    expect(mocked.installUploadedMod).toHaveBeenCalledWith(
      "Example-1.2.3.jar",
      expect.any(String),
      "1.21.11",
      undefined,
      false,
    );
    await waitFor(() => expect(onInstalled).toHaveBeenCalled());
    expect(await screen.findByText("Done")).toBeTruthy();
  });

  it("never installs a file the backend says is not a mod", async () => {
    mocked.inspectModFile.mockResolvedValue(
      inspection({
        installable: false,
        modId: null,
        minecraft: null,
        problems: [{ severity: "error", message: "This archive has no fabric.mod.json, so it is not a Fabric mod." }],
      }),
    );
    render(<ModUpload version="1.21.11" fabricReady onInstalled={vi.fn()} />);
    choose("thing.jar");
    expect(await screen.findByText(/no fabric\.mod\.json/)).toBeTruthy();
    const install = screen.getByRole("button", { name: /Install/ }) as HTMLButtonElement;
    expect(install.disabled).toBe(true);
    fireEvent.click(install);
    expect(mocked.installUploadedMod).not.toHaveBeenCalled();
  });

  it("warns about a mod that is already installed and asks before replacing it", async () => {
    mocked.inspectModFile.mockResolvedValue(
      inspection({
        duplicateOf: "Example-1.0.jar",
        problems: [{ severity: "warning", message: "This mod is already installed as “Example-1.0.jar”." }],
      }),
    );
    mocked.installUploadedMod.mockResolvedValue({
      fileName: "Example-1.2.3.jar",
      status: "installed",
      message: "Installed as Example-1.2.3.jar and removed Example-1.0.jar.",
    });
    render(<ModUpload version="1.21.11" fabricReady onInstalled={vi.fn()} />);

    choose("Example-1.2.3.jar");
    expect(await screen.findByText(/already installed as/)).toBeTruthy();

    // Without the tick, nothing is sent to the backend.
    fireEvent.click(screen.getByRole("button", { name: "Install mod" }));
    await screen.findByText("Nothing was installed");
    expect(mocked.installUploadedMod).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Replace the copy that is already installed"));
    fireEvent.click(screen.getByRole("button", { name: "Install mod" }));
    await waitFor(() => expect(mocked.installUploadedMod).toHaveBeenCalledTimes(1));
    expect(mocked.installUploadedMod).toHaveBeenCalledWith(
      "Example-1.2.3.jar",
      expect.any(String),
      "1.21.11",
      undefined,
      true,
    );
  });
});

function hit(over: Partial<PackHit> = {}): PackHit {
  return {
    provider: "modrinth",
    id: "clean",
    title: "Clean",
    description: "Neat skies",
    author: "Ana",
    downloads: 120_000,
    iconUrl: null,
    pageUrl: "https://modrinth.com/resourcepack/clean",
    resolution: "64x",
    ...over,
  };
}

function details(over: Partial<PackDetails> = {}): PackDetails {
  return {
    provider: "modrinth",
    id: "clean",
    title: "Clean",
    description: "Neat skies",
    longDescription: "A calm, clean pack.",
    author: "Ana",
    downloads: 120_000,
    iconUrl: null,
    pageUrl: "https://modrinth.com/resourcepack/clean",
    gallery: [],
    versions: ["1.21.11", "1.21.1"],
    resolution: "64x",
    fileName: "Clean.zip",
    fileSize: 1024 * 1024,
    ...over,
  };
}

describe("texture pack browsing", () => {
  it("says so when nothing matches, and offers a clean way out", async () => {
    render(<PackBrowser version="1.21.11" gameInstalled />);
    expect(await screen.findByText("No packs found")).toBeTruthy();
    expect(mocked.searchResourcePacks).toHaveBeenCalledWith("modrinth", "", "1.21.11", 0, undefined, undefined);
    // Clearing the filters asks for the page again, and the cache answers it.
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByText("No packs found")).toBeTruthy());
    expect(mocked.searchResourcePacks).toHaveBeenCalledTimes(1);
  });

  it("reports an API failure and lets the person try again", async () => {
    mocked.searchResourcePacks.mockRejectedValueOnce(new Error("The pack site answered with an error (503)."));
    render(<PackBrowser version="1.21.11" gameInstalled />);
    expect(await screen.findByText(/answered with an error \(503\)/)).toBeTruthy();
    mocked.searchResourcePacks.mockResolvedValueOnce({ hits: [hit()], total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Clean")).toBeTruthy();
  });

  it("opens a pack's details and installs it without switching it on", async () => {
    mocked.searchResourcePacks.mockResolvedValue({ hits: [hit()], total: 1 });
    mocked.resourcePackDetails.mockResolvedValue(details());
    mocked.installResourcePack.mockResolvedValue({
      fileName: "Clean.zip",
      size: 1024 * 1024,
      description: "Neat skies",
      packFormat: 34,
      enabled: false,
      icon: null,
    });
    render(<PackBrowser version="1.21.11" gameInstalled />);

    fireEvent.click(await screen.findByRole("button", { name: /Clean/ }));
    expect(await screen.findByText("A calm, clean pack.")).toBeTruthy();
    expect(screen.getByText(/1\.21\.11, 1\.21\.1/)).toBeTruthy();
    expect(screen.getByText(/From Modrinth/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Install pack" }));
    await waitFor(() => expect(mocked.installResourcePack).toHaveBeenCalledWith("modrinth", "clean", "1.21.11", undefined));
    expect(await screen.findByText(/Cirrus never switches a pack on by itself/)).toBeTruthy();
  });

  it("will not offer to install when there is no file for this version", async () => {
    mocked.searchResourcePacks.mockResolvedValue({ hits: [hit()], total: 1 });
    mocked.resourcePackDetails.mockResolvedValue(details({ fileName: null, fileSize: null, versions: [] }));
    render(<PackBrowser version="1.21.11" gameInstalled />);
    fireEvent.click(await screen.findByRole("button", { name: /Clean/ }));
    expect(await screen.findByText("No build for Minecraft 1.21.11.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Install pack" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists installed packs separately and switches one on only when asked", async () => {
    mocked.listResourcePacks.mockResolvedValue([
      {
        fileName: "Clean.zip",
        size: 1024 * 1024,
        description: "Neat skies",
        packFormat: 34,
        enabled: false,
        icon: null,
      },
    ]);
    mocked.setResourcePackEnabled.mockResolvedValue(true);
    render(<PackBrowser version="1.21.11" gameInstalled />);
    fireEvent.click(screen.getByRole("tab", { name: /Installed/ }));

    const toggle = await screen.findByRole("switch", { name: "Switch on Clean.zip" });
    expect((toggle as HTMLButtonElement).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    await waitFor(() => expect(mocked.setResourcePackEnabled).toHaveBeenCalledWith("1.21.11", "Clean.zip", true, undefined));
  });

  it("asks twice before removing a pack", async () => {
    mocked.listResourcePacks.mockResolvedValue([
      {
        fileName: "Clean.zip",
        size: 1024,
        description: null,
        packFormat: 34,
        enabled: true,
        icon: null,
      },
    ]);
    mocked.removeResourcePack.mockResolvedValue(undefined);
    render(<PackBrowser version="1.21.11" gameInstalled />);
    fireEvent.click(screen.getByRole("tab", { name: /Installed/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Remove Clean.zip" }));
    expect(mocked.removeResourcePack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removing Clean.zip" }));
    await waitFor(() => expect(mocked.removeResourcePack).toHaveBeenCalledWith("1.21.11", "Clean.zip", undefined));
  });
});

describe("character viewer", () => {
  it("has front, back, side, rotation, reset and zoom controls", () => {
    render(<SkinViewer skin="data:image/png;base64,x" model="slim" label="Alex" initialScale={10} />);
    for (const name of ["Front view", "Back view", "Left side view", "Right side view", "Turn the character", "Reset camera", "Zoom out", "Zoom in"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("turns, zooms and resets without leaving the current view", () => {
    render(<SkinViewer skin="data:image/png;base64,x" model="classic" label="Steve" initialScale={10} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn the character" }));
    expect(screen.getByRole("button", { name: "Stop turning" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("110%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("120%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset camera" }));
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn the character" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the back and side of the figure when asked", () => {
    render(<SkinViewer skin="data:image/png;base64,x" model="classic" label="Steve" />);
    fireEvent.click(screen.getByRole("button", { name: "Back view" }));
    expect(screen.getByText("Back")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Left side view" }));
    expect(screen.getByText("Left side")).toBeTruthy();
  });
});

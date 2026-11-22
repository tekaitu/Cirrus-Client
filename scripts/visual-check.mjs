// Takes screenshots of every page of the built app (dist/) in both appearances and several window sizes.
// The desktop commands are answered by made-up data, so this checks LAYOUT only, not real behaviour.
// Usage: node scripts/visual-check.mjs <outDir>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = process.argv[2] ?? "shots";
fs.mkdirSync(out, { recursive: true });
const dist = path.resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(dist, p);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4173, r));

/** Runs in the page before the app starts: a stand-in for the desktop backend. */
function installMock() {
  const callbacks = {};
  const listeners = {};
  let next = 1;
  const png = (draw) => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const g = c.getContext("2d");
    draw(g);
    return c.toDataURL("image/png");
  };
  const skin = (hair, shirt, pants) =>
    png((g) => {
      const r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      r(hair, 8, 0, 8, 8); r(hair, 0, 8, 32, 8);
      r("#c58c6b", 8, 8, 8, 8); r("#c58c6b", 0, 8, 8, 8); r("#c58c6b", 16, 8, 8, 8); r("#c58c6b", 24, 8, 8, 8);
      r("#3a2a22", 10, 12, 2, 2); r("#3a2a22", 13, 12, 2, 2);
      r(shirt, 16, 16, 24, 4); r(shirt, 20, 20, 8, 12); r(shirt, 16, 20, 4, 12); r(shirt, 28, 20, 4, 12); r(shirt, 32, 20, 8, 12);
      r("#c58c6b", 40, 16, 16, 16); r(shirt, 44, 20, 4, 4); r("#c58c6b", 44, 24, 4, 8);
      r(pants, 0, 16, 16, 4); r(pants, 4, 20, 4, 12); r(pants, 0, 20, 4, 12); r(pants, 8, 20, 4, 12); r(pants, 12, 20, 4, 12);
      r("#c58c6b", 32, 48, 16, 16); r(shirt, 36, 52, 4, 4); r("#c58c6b", 36, 56, 4, 8); r(pants, 16, 48, 16, 16);
      r(pants, 20, 52, 4, 12);
    });
  const capeTexture = png((g) => {
    g.fillStyle = "#1c2b4d";
    g.fillRect(1, 1, 10, 16);
    g.fillStyle = "#e8f0ff";
    g.fillRect(3, 7, 6, 3);
    g.fillRect(4, 5, 2, 2);
    g.fillRect(7, 4, 2, 3);
    g.fillStyle = "#ffffff";
    g.fillRect(2, 2, 1, 1);
    g.fillRect(9, 2, 1, 1);
  });
  const icon = (a, b) =>
    png((g) => {
      const grd = g.createLinearGradient(0, 0, 64, 64); grd.addColorStop(0, a); grd.addColorStop(1, b);
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64); g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(18, 18, 28, 28);
    });
  const steve = skin("#3b2a1d", "#1f9fb5", "#3f3f9b");
  const alex = skin("#c9742b", "#7a3fb5", "#2d2d2d");
  const skins = [
    { id: "steve", name: "Steve", model: "classic", source: "file", dataUrl: steve },
    { id: "alex", name: "Alex", model: "slim", source: "player:Alex", dataUrl: alex },
    { id: "night", name: "Night shift", model: "classic", source: "url", dataUrl: skin("#111", "#2b2b45", "#1b1b2b") },
  ];
  const mods = [
    ["sodium-fabric-0.6.0.jar", "Sodium", "0.6.0", "A modern rendering engine that improves frame rates and fixes graphical issues.", ["JellySquid", "IMS"], true, icon("#1f9d55", "#0e5b32")],
    ["lithium-fabric-0.14.jar", "Lithium", "0.14.3", "A general-purpose optimization mod for game logic and physics.", ["JellySquid"], true, icon("#3b82f6", "#1e3a8a")],
    ["iris-1.8.jar", "Iris Shaders", "1.8.1", "Shader support that works with Sodium.", ["coderbot"], false, icon("#d946ef", "#701a75")],
    ["fabric-api-0.119.jar", "Fabric API", "0.119.2", "Essential hooks for modding with Fabric.", ["modmuss50"], true, icon("#f59e0b", "#92400e")],
    ["modmenu-13.0.jar", "Mod Menu", "13.0.0", "Adds a screen listing your mods.", ["Prospector"], true, null],
    ["ferrite-core.jar", null, null, null, [], true, null],
  ].map(([fileName, name, version, description, authors, enabled, ic]) => ({
    fileName: enabled ? fileName : fileName + ".disabled", size: 2_097_152, enabled, name, version, description, authors, icon: ic,
  }));
  const hits = ["Sodium", "Lithium", "Iris Shaders", "Fabric API", "Mod Menu", "Ferrite Core"].map((t, i) => ({
    provider: "modrinth", id: "p" + i, title: t, description: "A fast and lightweight mod that makes Minecraft run better on every kind of computer.",
    author: ["JellySquid", "coderbot", "modmuss50", "Prospector"][i % 4], downloads: 12_345_678 - i * 1_234_567, iconUrl: null, pageUrl: null,
  }));
  const java = {
    path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.7-hotspot\\bin\\java.exe", source: "Common install folder", ran: true,
    output: 'openjdk version "21.0.4" 2024-07-16 LTS\nOpenJDK Runtime Environment Temurin-21.0.4+7 (build 21.0.4+7-LTS)\nOpenJDK 64-Bit Server VM Temurin-21.0.4+7 (build 21.0.4+7-LTS, mixed mode, sharing)',
    error: null,
  };
  const settings = {
    settings: { version: 2, javaPath: null, memoryMb: 4096, gameDir: "C:\\Users\\player\\AppData\\Roaming\\com.cirrus.app\\game", windowWidth: 1280, windowHeight: 720, jvmArgs: "", reduceMotion: false, msClientId: null },
    status: "loaded", message: null, filePath: "C:\\Users\\player\\AppData\\Roaming\\com.cirrus.app\\settings.json",
    totalRamMb: 15800, minMemoryMb: 1024, maxMemoryMb: 13568,
  };
  const profile = { id: "0123456789abcdef0123456789abcdef", name: "Brend4n" };
  const alt = { id: "fedcba9876543210fedcba9876543210", name: "Aurora" };
  const signedIn = { state: "signedIn", configured: true, savedLogin: true, profile, accounts: [profile, alt], activeId: profile.id, message: null };
  const signedOut = { state: "signedOut", configured: true, savedLogin: true, profile: null, accounts: [profile, alt], activeId: profile.id, message: null };
  const log = [
    "[Cirrus Client 0.3.1] Starting Minecraft 1.21.11 (Fabric)",
    "[Cirrus Client] Java: C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.7-hotspot\\bin\\java.exe",
    "[Cirrus Client] Memory: 4096 MB", "[Cirrus Client] Player: Brend4n (microsoft)", "----------------------------------------",
    "[12:01:02] [main/INFO]: Loading Minecraft 1.21.11 with Fabric Loader 0.17.2",
    "[12:01:03] [main/INFO]: Loading 6 mods: fabric-api 0.119.2, iris 1.8.1, lithium 0.14.3, modmenu 13.0.0, sodium 0.6.0",
    "[12:01:05] [Render thread/INFO]: Setting user: Brend4n", "[12:01:06] [Render thread/INFO]: Backend library: LWJGL version 3.3.3",
    "[12:01:08] [Render thread/WARN]: Missing sound for event: minecraft:item.goat_horn.play",
  ].join("\n") + "\n";
  const crashReport = "---- Minecraft Crash Report ----\n// Don't be sad, have a hug! <3\n\nTime: 2026-11-15 12:03:11\nDescription: Exception in server tick loop\n\njava.lang.OutOfMemoryError: Java heap space\n\tat net.minecraft.class_2818.method_12206(class_2818.java:120)\n\tat net.minecraft.server.MinecraftServer.method_3813(MinecraftServer.java:864)\n\nA detailed walkthrough of the error, its code path and all known details is as follows:\n---------------------------------------------------------------------------------------\n-- System Details --\nDetails:\n\tMinecraft Version: 1.21.11\n\tOperating System: Windows 10 (amd64) version 10.0\n\tJava Version: 21.0.4, Eclipse Adoptium\n\tMemory: 12345678 bytes (11 MiB) / 4294967296 bytes (4096 MiB) up to 4294967296 bytes (4096 MiB)\n";
  window.__crash = { hint: "Minecraft ran out of memory. Give it more in Settings > Memory and RAM, or switch off heavy mods.", report: crashReport, reportPath: "C:\\game\\crash-reports\\crash-2026-11-15.txt", logTail: log };
  let logOffset = 0;
  const handlers = {
    get_app_info: () => ({ name: "Cirrus Client", version: "0.3.3", target_minecraft: "1.21.11", launcher_ready: true }),
    get_system_info: () => ({ osName: "Windows", osVersion: "10 (19045)", osLongVersion: "Windows 10 Pro", kernelVersion: "19045", arch: "x86_64", cpuBrand: "AMD Ryzen 5 PRO 4650G with Radeon Graphics", cpuLogicalCores: 12, cpuPhysicalCores: 6, totalRamMb: 15800, availableRamMb: 9000 }),
    detect_java: () => ({ installs: [java], candidatesChecked: 6, notes: ["Checked 6 places."] }),
    load_settings: () => settings, save_settings: () => ({ ok: true, errors: [], state: settings }),
    auth_status: () => signedOut, auth_restore: () => signedIn,
    auth_switch: (a) => ({ ...signedIn, profile: a.id === alt.id ? alt : profile, activeId: a.id === alt.id ? alt.id : profile.id }),
    auth_sign_in: () => signedIn, auth_sign_in_window: () => signedIn, auth_cancel: () => true,
    auth_sign_out: () => ({ ...signedOut, accounts: [], activeId: null }),
    list_game_versions: () => ["1.21.11", "1.21.10", "1.21.8", "1.20.6"],
    game_status: () => ({ installed: true, minecraft: "1.21.11", loader: "0.17.2", gameDir: settings.settings.gameDir, running: false }),
    list_instances: () => [{ minecraft: "1.21.11", loader: "0.17.2", modCount: 6 }, { minecraft: "1.20.6", loader: null, modCount: 0 }],
    list_instance_views: () => [
      { id: "inst-1", minecraft: "1.21.11", loader: "fabric", loaderVersion: "0.17.2", name: "PvP", icon: 0, javaPath: null, memoryMb: 6144, gameDir: settings.settings.gameDir, customGameDir: false, jvmArgs: "", lastPlayed: Date.now() - 3600000, modCount: 6, javaMajor: 21, clonedFrom: null },
      { id: "inst-2", minecraft: "1.20.6", loader: "vanilla", loaderVersion: null, name: "Building", icon: 3, javaPath: null, memoryMb: null, gameDir: settings.settings.gameDir, customGameDir: false, jvmArgs: "", lastPlayed: Date.now() - 86400000 * 3, modCount: 0, javaMajor: 21, clonedFrom: null },
      { id: "inst-3", minecraft: "1.8.9", loader: "vanilla", loaderVersion: null, name: "Old PvP", icon: 5, javaPath: null, memoryMb: 2048, gameDir: settings.settings.gameDir, customGameDir: false, jvmArgs: "", lastPlayed: 0, modCount: 0, javaMajor: 8, clonedFrom: null },
    ],
    list_game_version_catalog: () => [
      { id: "1.21.11", kind: "release", released: "2025-12-02T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.21.8", kind: "release", released: "2025-07-17T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.21.1", kind: "release", released: "2024-08-08T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.20.6", kind: "release", released: "2024-04-29T10:00:00+00:00", supported: true, javaMajor: 21 },
      { id: "1.20.1", kind: "release", released: "2023-06-12T10:00:00+00:00", supported: true, javaMajor: 17 },
      { id: "1.12.2", kind: "release", released: "2017-09-18T10:00:00+00:00", supported: true, javaMajor: 8 },
      { id: "1.8.9", kind: "release", released: "2015-12-09T10:00:00+00:00", supported: true, javaMajor: 8 },
    ],
    fabric_loader_versions: () => [
      { version: "0.17.2", stable: true, minecraft: "1.21.11" },
      { version: "0.16.10", stable: true, minecraft: "1.21.11" },
      { version: "0.16.9", stable: false, minecraft: "1.21.11" },
    ],
    instance_contents: () => ({ worlds: 2, screenshots: 4, mods: 6, resourcePacks: 1 }),
    save_instance: () => null, clone_instance: () => null, delete_instance: () => null,
    repair_instance: () => ({ status: "installed", message: null, loader: "0.17.2" }),
    switch_fabric_loader: () => null, open_instance_folder: () => null,
    check_for_updates: () => ({ current: "0.3.3", latest: "0.3.3", available: false, notes: "", pageUrl: null, downloadUrl: null, publishedAt: null, installReady: false, installMessage: "Automatic installation needs a signed release; this build links to the official download." }),
    open_update_page: () => null,
    diagnose_crash: () => ({ cause: "Minecraft ran out of the memory it was given. The heap filled up while the server tick loop was running.", confidence: "high", evidence: ["java.lang.OutOfMemoryError: Java heap space", "Memory: 4096 MiB"], fixes: [{ kind: "memory", label: "Raise this instance to 6144 MB", detail: "Changes only this instance's memory limit and keeps a backup of the settings file.", value: "6144", changesSettings: true }, { kind: "mods", label: "Review installed mods", detail: "A large modpack can need more memory than the default.", value: null, changesSettings: false }], excerpt: "java.lang.OutOfMemoryError: Java heap space", unknown: false }),
    list_profiles: () => [{ id: "pvp", name: "PvP", minecraft: "1.21.11", fabric: true, color: 0 }],
    list_mods: () => mods, search_mods: () => ({ hits, total: 6 }), curseforge_available: () => false,
    list_skins: () => skins, player_skin: () => steve,
    player_appearance: () => ({ id: profile.id, name: profile.name, model: "classic", skin: steve, cape: capeTexture }),
    launch_game: () => { logOffset = 0; return { started: true, message: null, logPath: "C:\\game\\logs\\cirrus-launch.log" }; },
    read_game_log: (a) => { const text = log.slice(a.offset ?? 0); return { text, offset: log.length }; },
    open_game_folder: () => null, discord_available: () => true, discord_set_presence: () => "ok", discord_clear_presence: () => "ok",
    stop_game: () => true,
  };
  window.__emit = (event, payload) => (listeners[event] ?? []).forEach((id) => callbacks[id]?.({ event, id, payload }));
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback: (cb) => { const id = next++; callbacks[id] = cb; return id; },
    unregisterCallback: (id) => { delete callbacks[id]; },
    convertFileSrc: (s) => s,
    invoke: async (cmd, args) => {
      if (cmd === "plugin:event|listen") { (listeners[args.event] ??= []).push(args.handler); return next++; }
      if (cmd.startsWith("plugin:event|")) return null;
      if (cmd.startsWith("plugin:window|")) return null;
      const h = handlers[cmd];
      if (!h) throw new Error("mock: no handler for " + cmd);
      return h(args ?? {});
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}

const browser = await chromium.launch();

async function session(theme, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(installMock);
  await ctx.addInitScript(([t]) => {
    try {
      localStorage.setItem("unlimited.license", "2");
      localStorage.setItem("unlimited.theme", t);
    } catch {}
  }, [theme]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://localhost:4173/");
  await page.waitForSelector(".hdr");
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

const nav = async (page, name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(650); };
const snap = async (page, name) => { await page.screenshot({ path: path.join(out, name + ".png") }); };

const report = [];
async function run(theme, w, h, steps) {
  const { ctx, page, errors } = await session(theme, w, h);
  for (const [label, fn] of steps) {
    try { await fn(page); await snap(page, `${theme}-${w}x${h}-${label}`); }
    catch (e) { report.push(`FAILED ${theme} ${w}x${h} ${label}: ${String(e).split("\n")[0]}`); }
  }
  if (errors.length) report.push(`console errors (${theme} ${w}x${h}): ${[...new Set(errors)].slice(0, 5).join(" | ")}`);
  await ctx.close();
}

const pages = [
  ["home", async () => {}],
  ["versions", (p) => nav(p, "Versions")],
  ["browse", (p) => nav(p, "Browse")],
  ["browse-list", async (p) => { await nav(p, "Browse"); await p.getByRole("radio", { name: "List results" }).click().catch(() => {}); await p.waitForTimeout(400); }],
  ["mods", (p) => nav(p, "Mods")],
  ["modpacks", (p) => nav(p, "Modpacks")],
  ["character", (p) => nav(p, "Character")],
  ["library", (p) => nav(p, "Library")],
  ["library-settings", async (p) => { await nav(p, "Library"); await p.getByRole("button", { name: "Settings for PvP" }).click(); await p.waitForTimeout(600); }],
  ["install", async (p) => { await nav(p, "Versions"); await p.getByRole("button", { name: /Minecraft 1\.21/ }).click(); await p.waitForTimeout(500); await p.getByRole("button", { name: "Install", exact: true }).first().click(); await p.waitForTimeout(900); }],
  ["servers", (p) => nav(p, "Servers")],
  ["accounts", async (p) => { await p.getByRole("button", { name: "Account", exact: true }).click(); await p.waitForTimeout(500); await p.getByRole("button", { name: "Manage accounts" }).click(); await p.waitForTimeout(650); }],
  ["account-menu", async (p) => { await p.getByRole("button", { name: "Account", exact: true }).click(); await p.waitForTimeout(600); }],
  ["bell", async (p) => { await p.getByRole("button", { name: /^Notifications/ }).click(); await p.waitForTimeout(500); }],
  ["settings", (p) => nav(p, "Settings")],
  ["settings-appearance", async (p) => { await nav(p, "Settings"); await p.getByRole("tab", { name: /Appearance/ }).click().catch(async () => { await p.getByText("Appearance", { exact: true }).first().click(); }); await p.waitForTimeout(400); }],
  ["about", (p) => nav(p, "About")],
  ["diagnostics", async (p) => { await nav(p, "Settings"); await nav(p, "Diagnostics"); }],
];
const core = ["home", "versions", "library", "browse", "mods", "modpacks", "character", "servers", "accounts", "settings"];
await run("dark", 1920, 1080, pages.filter(([n]) => ["home", "versions", "library", "install", "browse", "mods"].includes(n)));
await run("dark", 1600, 900, pages);
await run("light", 1600, 900, pages.filter(([n]) => core.includes(n)));
await run("dark", 1366, 768, pages.filter(([n]) => core.includes(n)));
await run("light", 1366, 768, pages.filter(([n]) => ["home", "browse", "settings"].includes(n)));
await run("dark", 1000, 640, pages.filter(([n]) => ["home", "versions", "browse", "mods", "settings"].includes(n)));

// Launch log and crash dialog
for (const theme of ["dark", "light"]) {
  await run(theme, 1366, 768, [
    ["launch-log", async (p) => {
      await p.getByRole("button", { name: "Play", exact: true }).first().click();
      await p.waitForTimeout(900);
      await p.getByRole("button", { name: "View log" }).first().click();
      await p.waitForTimeout(900);
    }],
    ["crash", async (p) => {
      await p.evaluate((c) => window.__emit("game-exited", { code: 1, logPath: "x", stopped: false, crash: window.__crash }), null);
      await p.waitForTimeout(900);
    }],
  ]);
}
fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") || "no problems found by the script\n");
console.log(report.join("\n") || "ok");
await browser.close();
server.close();

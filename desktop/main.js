// OnCue desktop shell. A thin window around the hosted app, so every deploy reaches the desktop app
// without a new download. Sign-in and show data live on the web app and Supabase, as they do in a browser.
const { app, BrowserWindow, Menu, shell, powerSaveBlocker } = require("electron");
const path = require("path");
const fs = require("fs");

const APP_URL = process.env.ONCUE_URL || require("./config.json").url;
const APP_ORIGIN = new URL(APP_URL).origin;
const isMac = process.platform === "darwin";

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let blockerId = null;

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch { /* not worth interrupting a show over */ }
}

// A stage manager calling a show should never have the display dim.
function setAwake(on) {
  if (on && blockerId == null) blockerId = powerSaveBlocker.start("prevent-display-sleep");
  if (!on && blockerId != null) { powerSaveBlocker.stop(blockerId); blockerId = null; }
}

function showOffline() {
  if (win && !win.isDestroyed()) win.loadFile(path.join(__dirname, "offline.html"), { query: { url: APP_URL } });
}

function createWindow() {
  const s = loadState();
  win = new BrowserWindow({
    width: s.width || 1440, height: s.height || 900, x: s.x, y: s.y,
    minWidth: 380, minHeight: 600,
    title: "OnCue",
    backgroundColor: "#E7E8E2",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (s.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);

  // Anything that isn't the app (help links, mailto) opens in the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file:")) return;
    if (new URL(url).origin !== APP_ORIGIN) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) showOffline(); // -3 is a cancelled navigation, not a failure
  });

  win.loadURL(APP_URL);
}

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" }, { role: "forceReload" }, { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" },
        { role: "togglefullscreen" }, { type: "separator" },
        { label: "Keep screen awake", type: "checkbox", checked: true, click: (item) => setAwake(item.checked) },
      ],
    },
    { role: "windowMenu" },
    ...(isMac ? [] : [{ label: "File", submenu: [{ role: "quit" }] }]),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  buildMenu();
  setAwake(true);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (!isMac) app.quit(); });

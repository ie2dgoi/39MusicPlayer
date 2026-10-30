import { app, BrowserWindow, Menu, MenuItem, session, protocol } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ConfigManager from "./scripts/configManager.js";
import { registerProtocolHandler } from "./scripts/protocolHandler.js";
import { registerIPC } from "./scripts/ipcHandler.js";
import { createTray } from "./scripts/trayManager.js";
import { setupAutoUpdater } from "./scripts/autoUpdater.js";
import Logger from "./scripts/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = "39MusicPlayer";

let mainWindow;
let configManager;
let tray;
const appLock = app.requestSingleInstanceLock();

function focus() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }
        mainWindow.focus();
    }
}

function createWindow() {
    const appVersion = app.getVersion();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 840,
        minHeight: 560,
        title: `${APP_NAME} v${appVersion}`,
        icon: path.join(__dirname, "resources/icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            backgroundThrottling: false,
        },
        autoHideMenuBar: true,
        show: false,
    });

    mainWindow.setFullScreen(configManager.get("fullscreen", false));

    initShortcuts();

    mainWindow.loadFile(path.join(__dirname, "screen/index.html")).catch((err) => {
        Logger.error("加载 index.html 失败:", err);
    });

    mainWindow.on("close", (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
        return true;
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    return mainWindow;
}

function initShortcuts() {
    const menu = new Menu();

    // 添加应用菜单(macOS)
    if (process.platform === "darwin") {
        menu.append(new MenuItem({ role: "appMenu" }));
    }

    // 菜单项配置
    const menuItems = [
        {
            label: "Full screen",
            click: () => {
                mainWindow.setFullScreen(!mainWindow.isFullScreen());
                configManager.set("fullscreen", mainWindow.isFullScreen());
            },
            accelerator: "F11",
        },
    ];

    // 开发者工具
    if (process.env.NODE_ENV === "development" || !app.isPackaged) {
        menuItems.push({
            label: "Open DevTools",
            click: () => mainWindow.webContents.openDevTools(),
            accelerator: "f12",
        });
        menuItems.push({
            label: "Reload window",
            click: () => mainWindow.reload(),
            accelerator: "CommandOrControl+R",
        });
    }

    const submenu = Menu.buildFromTemplate(menuItems);
    menu.append(new MenuItem({ label: "Custom Menu", submenu }));
    Menu.setApplicationMenu(menu);
}

function initializeApp() {
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
        Logger.info("跳过 SSL 验证:", request.hostname);
        callback(0);
    });

    configManager = new ConfigManager(APP_NAME);
    const logFile = Logger.init(configManager.configDir);

    registerProtocolHandler(app);
    registerIPC(app, configManager);

    createWindow();
    tray = createTray(app, focus);

    setupAutoUpdater(mainWindow, configManager);
}

if (!appLock) {
    app.quit();
} else {
    app.on("second-instance", focus);

    protocol.registerSchemesAsPrivileged([
        {
            scheme: "res",
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                corsEnabled: true,
            },
        },
    ]);

    app.whenReady().then(() => {
        app.isQuitting = false;
        initializeApp();
        app.on("activate", () => {
            if (mainWindow === null) {
                initializeApp();
            }
        });
    });

    app.on("window-all-closed", () => {});

    app.on("before-quit", () => {
        Logger.info("应用程序正在退出...");
        app.isQuitting = true;
    });

    process.on("uncaughtException", (error) => {
        Logger.error("未捕获的异常:", error);
    });

    process.on("unhandledRejection", (reason, promise) => {
        Logger.error("未处理的 Promise 拒绝，位置:", promise, "原因:", reason);
    });
}

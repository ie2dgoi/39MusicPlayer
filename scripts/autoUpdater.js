import autoUpdaterModule from "electron-updater";
import { app } from "electron";
import Logger from "./logger.js";

const { autoUpdater } = autoUpdaterModule;

// 启动后延迟多久做第一次自动检查，以及之后的轮询间隔
const STARTUP_CHECK_DELAY = 10 * 1000;
const PERIODIC_CHECK_INTERVAL = 6 * 60 * 60 * 1000;

let targetWindow = null;
let eventsRegistered = false;
let startupTimer = null;
let periodicTimer = null;

function send(win, channel, data) {
    const msg = `[autoUpdater:${channel}]`;
    Logger.info(msg, data);
    if (!win || win.isDestroyed?.()) return;
    win.webContents?.send(channel, data);
}

const UPDATE_EVENT_MAP = {
    "checking-for-update": "update-status",
    "update-available": "update-available",
    "update-not-available": "update-not-available",
    "download-progress": "update-progress",
    "update-downloaded": "update-downloaded",
};

function registerUpdaterEvents(win) {
    targetWindow = win;

    // 事件只注册一次，重复调用只更新目标窗口，避免同一事件被发多次
    if (eventsRegistered) return;
    eventsRegistered = true;

    Object.entries(UPDATE_EVENT_MAP).forEach(([event, channel]) => {
        autoUpdater.on(event, (payload) => {
            send(targetWindow, channel, payload);
        });
    });

    autoUpdater.on("error", (error) => {
        Logger.error("[autoUpdater] 错误:", error);
        send(targetWindow, "update-error", {
            message: error?.message || String(error),
            stack: error?.stack,
        });
    });
}

/**
 * 把配置应用到 autoUpdater 实例上。
 * autoDownload / autoInstallOnAppQuit 恒为 true：用户手动点「检查更新」发现新版本时就该下载，
 * 否则 checkForUpdatesAndNotify() 只会走到 update-available 就停住，按钮点了等于没点。
 * update.autoUpdate 只控制「启动/定时自动检查」。
 */
function applyUpdaterSettings(configManager) {
    const autoUpdate = Boolean(configManager.get("update.autoUpdate", true));

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = Boolean(configManager.get("update.allowPrerelease", false));

    Logger.info(
        `[autoUpdater] 配置已应用：autoCheck=${autoUpdate} allowPrerelease=${autoUpdater.allowPrerelease}`,
    );

    return autoUpdate;
}

function scheduleAutoUpdateChecks() {
    // 开发环境没有 app-update.yml，检查必然报错，直接跳过
    if (!app.isPackaged) return;
    if (startupTimer || periodicTimer) return;

    startupTimer = setTimeout(() => {
        startupTimer = null;
        runAutoCheck("启动");
    }, STARTUP_CHECK_DELAY);

    periodicTimer = setInterval(() => runAutoCheck("定时"), PERIODIC_CHECK_INTERVAL);
}

function clearAutoUpdateChecks() {
    if (startupTimer) {
        clearTimeout(startupTimer);
        startupTimer = null;
    }
    if (periodicTimer) {
        clearInterval(periodicTimer);
        periodicTimer = null;
    }
}

async function runAutoCheck(reason) {
    try {
        Logger.info(`[autoUpdater] ${reason}自动检查更新`);
        await checkForUpdates();
    } catch (err) {
        Logger.warn(`[autoUpdater] ${reason}自动检查更新失败:`, err?.message || err);
    }
}

function setupAutoUpdater(win, configManager) {
    const autoUpdate = applyUpdaterSettings(configManager);
    registerUpdaterEvents(win);

    if (autoUpdate) {
        scheduleAutoUpdateChecks();
    } else {
        clearAutoUpdateChecks();
    }
}

/** 设置页改了更新相关配置后调用，立即生效，无需重启 */
function refreshUpdaterSettings(win, configManager) {
    const autoUpdate = applyUpdaterSettings(configManager);
    if (win) registerUpdaterEvents(win);

    if (autoUpdate) {
        scheduleAutoUpdateChecks();
    } else {
        clearAutoUpdateChecks();
    }

    return { autoUpdate, allowPrerelease: autoUpdater.allowPrerelease };
}

async function checkForUpdates() {
    if (!autoUpdater) {
        Logger.warn("[autoUpdater] autoUpdater 不可用，无法检查更新");
        send(targetWindow, "update-skipped", { message: "autoUpdater unavailable" });
        return null;
    }
    if (!app.isPackaged) {
        Logger.warn("[autoUpdater] 未打包运行，跳过检查更新");
        send(targetWindow, "update-skipped", { message: "Not packaged, skipped" });
        return null;
    }
    try {
        return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
        Logger.error("[autoUpdater] 检查更新失败:", err);
        throw err;
    }
}

export { autoUpdater, setupAutoUpdater, refreshUpdaterSettings, checkForUpdates };

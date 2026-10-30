import fs from "fs";
import { ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "node:url";
import CacheManager from "./cacheManager.js";
import ScriptLoader from "./scriptLoader.js";
import { checkForUpdates, refreshUpdaterSettings } from "./autoUpdater.js";
import Logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function registerIPC(app, configManager) {
    const cacheManager = new CacheManager(configManager);

    const scriptLoader = new ScriptLoader();

    const sourcesDir = path.join(configManager.getConfigDir(), "sources");
    fs.mkdirSync(sourcesDir, { recursive: true });
    const scriptsLoadedPromise = scriptLoader.loadFromDir(sourcesDir).catch(console.error);

    ipcMain.on("quit", (event) => {
        app.quit();
    });

    // 获取配置值
    ipcMain.handle("get-config", (event, key, defaultValue) => {
        return configManager.get(key, defaultValue);
    });

    // 设置配置值
    ipcMain.handle("set-config", (event, key, value) => {
        return configManager.set(key, value);
    });

    // 获取缓存
    ipcMain.handle("get-cache", async (event, cachePath) => {
        return await cacheManager.getCache(cachePath);
    });

    // 保存缓存
    ipcMain.handle("save-cache", async (event, cachePath, data) => {
        return await cacheManager.saveCache(cachePath, data);
    });

    // 删除指定缓存
    ipcMain.handle("delete-cache", async (event, cachePath) => {
        return await cacheManager.deleteCache(cachePath);
    });

    // 清空缓存
    ipcMain.handle("clear-cache", async (event) => {
        return await cacheManager.clearCache();
    });

    // 执行脚本
    ipcMain.handle("script-run", async (event, id, params) => {
        await scriptsLoadedPromise;
        return await scriptLoader.run(id, "run", params);
    });

    // 获取脚本列表
    ipcMain.handle("script-list", async () => {
        return scriptLoader.list();
    });

    // 获取脚本元信息
    ipcMain.handle("script-get-meta", async (event, id) => {
        return scriptLoader.getMeta(id);
    });

    // 重新加载所有脚本
    ipcMain.handle("script-reload-all", async () => {
        for (const { id } of scriptLoader.list()) {
            scriptLoader.unload(id);
        }
        await scriptLoader.loadFromDir(sourcesDir);
        return scriptLoader.list();
    });

    ipcMain.on("open-external", (event, url) => {
        shell.openExternal(url);
    });

    ipcMain.on("check-for-updates", async (event) => {
        try {
            return await checkForUpdates();
        } catch (err) {
            // 错误已经由 autoUpdater 的 error 事件推给渲染层，这里只记日志，避免重复上报
            Logger.error("[ipcHandler] 检查更新失败:", err);
        }
    });

    // 设置页切换「允许预览版」等选项后调用，让配置立即生效
    ipcMain.handle("refresh-update-settings", async () => {
        try {
            return refreshUpdaterSettings(null, configManager);
        } catch (err) {
            Logger.error("[ipcHandler] 刷新更新配置失败:", err);
            return null;
        }
    });

    ipcMain.on("log", (event, level, ...args) => {
        Logger[level](...args);
    });
}

export { registerIPC };

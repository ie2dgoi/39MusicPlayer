import { contextBridge, ipcRenderer } from "electron";
import * as marked from "marked";

contextBridge.exposeInMainWorld("electronAPI", {
    getConfig: (key, defaultValue) => ipcRenderer.invoke("get-config", key, defaultValue),
    setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

    openDialog: (options) => ipcRenderer.invoke("open-dialog", options),
    saveDialog: (options) => ipcRenderer.invoke("save-dialog", options),

    openExternal: (url) => ipcRenderer.send("open-external", url),

    quit: () => ipcRenderer.send("quit"),

    checkForUpdates: () => ipcRenderer.send("check-for-updates"),
    onUpdateStatus: (callback) => ipcRenderer.on("update-status", callback),
    onUpdateNotAvailable: (callback) => ipcRenderer.on("update-not-available", callback),
    onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
    onUpdateProgress: (callback) => ipcRenderer.on("update-progress", callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on("update-downloaded", callback),
    onUpdateSkipped: (callback) => ipcRenderer.on("update-skipped", callback),
    onUpdateError: (callback) => ipcRenderer.on("update-error", callback),
    refreshUpdateSettings: () => ipcRenderer.invoke("refresh-update-settings"),

    getCache: (cachePath) => ipcRenderer.invoke("get-cache", cachePath),
    saveCache: (cachePath, data) => ipcRenderer.invoke("save-cache", cachePath, data),
    deleteCache: (cachePath) => ipcRenderer.invoke("delete-cache", cachePath),
    clearCache: () => ipcRenderer.invoke("clear-cache"),

    scriptRun: (id, params) => ipcRenderer.invoke("script-run", id, params),
    scriptList: () => ipcRenderer.invoke("script-list"),
    scriptGetMeta: (id) => ipcRenderer.invoke("script-get-meta", id),
    scriptReloadAll: () => ipcRenderer.invoke("script-reload-all"),

    log: (level, ...args) => ipcRenderer.send("log", level, ...args),
});

contextBridge.exposeInMainWorld("marked", {
    parse: (markdown) => marked.parse(markdown),
});

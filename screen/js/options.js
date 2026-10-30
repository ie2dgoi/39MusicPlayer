let sourceSelectCustom = null;

const UPDATE_BTN_DEFAULT_TEXT = "Check";
const UPDATE_WATCHDOG_MS = 60 * 1000;

function setupUpdateSection() {
    const checkUpdateBtn = document.getElementById("check-update-btn");
    const progressBar = document.getElementById("update-progress-bar");
    const progressFill = document.getElementById("update-progress-fill");

    if (!checkUpdateBtn) return;

    let resetTimer = null;
    let watchdogTimer = null;

    const setProgressVisible = (visible) => {
        if (progressBar) progressBar.hidden = !visible;
    };

    const setProgress = (percent) => {
        if (!progressFill) return;
        const value = Math.max(0, Math.min(100, Number(percent) || 0));
        progressFill.style.width = `${value}%`;
    };

    const setButton = (text, disabled) => {
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
        checkUpdateBtn.textContent = text;
        checkUpdateBtn.disabled = Boolean(disabled);
    };

    const clearWatchdog = () => {
        if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
        }
    };

    // 终态提示：显示几秒后恢复默认文案
    const flashButton = (text) => {
        clearWatchdog();
        setButton(text, false);
        resetTimer = setTimeout(() => {
            resetTimer = null;
            setButton(UPDATE_BTN_DEFAULT_TEXT, false);
        }, 3000);
    };

    const armWatchdog = () => {
        clearWatchdog();
        watchdogTimer = setTimeout(() => {
            watchdogTimer = null;
            setProgressVisible(false);
            setProgress(0);
            flashButton("Timed out, try again");
        }, UPDATE_WATCHDOG_MS);
    };

    checkUpdateBtn.addEventListener("click", () => {
        setButton("Checking...", true);
        setProgressVisible(false);
        setProgress(0);
        armWatchdog();
        window.electronAPI.checkForUpdates();
    });

    // checking-for-update 事件不带 payload，保持「检查中」状态即可
    window.electronAPI.onUpdateStatus(() => {
        setButton("Checking...", true);
        armWatchdog();
    });

    window.electronAPI.onUpdateNotAvailable(() => {
        setProgressVisible(false);
        setProgress(0);
        flashButton("Up to date");
    });

    window.electronAPI.onUpdateAvailable(() => {
        setProgressVisible(true);
        setProgress(0);
        setButton("Downloading 0%", true);
        armWatchdog();
    });

    window.electronAPI.onUpdateProgress((_event, data) => {
        const percent = Math.max(0, Math.min(100, Number(data?.percent) || 0));
        setProgressVisible(true);
        setProgress(percent);
        setButton(`Downloading ${Math.round(percent)}%`, true);
        armWatchdog();
    });

    window.electronAPI.onUpdateDownloaded(() => {
        setProgressVisible(true);
        setProgress(100);
        flashButton("Downloaded, restart to install");
        checkUpdateBtn.disabled = false;
    });

    window.electronAPI.onUpdateSkipped((_event, data) => {
        setProgressVisible(false);
        setProgress(0);
        const message = typeof data === "string" ? data : data?.message || "Skipped";
        flashButton(`Skipped: ${message}`);
    });

    window.electronAPI.onUpdateError((_event, data) => {
        setProgressVisible(false);
        setProgress(0);
        const message = typeof data === "string" ? data : data?.message || "Unknown error";
        flashButton(`Error: ${message}`);
    });
}

async function setupOptions() {
    setupUpdateSection();

    // 添加可视化开关
    const visualizerToggleContainer = document.getElementById("visualizer-toggle-container");
    if (visualizerToggleContainer) {
        window.electronAPI.getConfig("visualizer.enabled", true).then((enabled) => {
            enableVisualizer = enabled;
            new ToggleSwitch(visualizerToggleContainer, enabled, (enabled) => {
                window.electronAPI.setConfig("visualizer.enabled", enabled);
                enableVisualizer = enabled;
            });
        });
    }

    // 添加允许预览版开关（改完立即重新应用更新配置，不用重启）
    const prereleaseToggleContainer = document.getElementById("prerelease-toggle-container");
    if (prereleaseToggleContainer) {
        window.electronAPI.getConfig("update.allowPrerelease", false).then((allowPrerelease) => {
            new ToggleSwitch(prereleaseToggleContainer, allowPrerelease, (enabled) => {
                window.electronAPI.setConfig("update.allowPrerelease", enabled);
                window.electronAPI.refreshUpdateSettings();
            });
        });
    }

    // 初始化音源选择器
    await initSourceSelector();
}

async function initSourceSelector() {
    const container = document.getElementById("source-select-custom");
    if (!container) return;

    try {
        const sources = await window.electronAPI.scriptList();
        if (!sources || sources.length === 0) return;

        const sourceNames = sources.map((s) => s.name);
        const sourceIds = sources.map((s) => s.id);

        let savedSource = await window.electronAPI.getConfig("searchSource", sourceIds[0]);
        let currentIndex = sourceIds.indexOf(savedSource);

        // 如果保存的源无效，回退到第一个可用源
        if (currentIndex < 0) {
            savedSource = sourceIds[0];
            currentIndex = 0;
            // 更新配置为有效的源ID
            window.electronAPI.setConfig("searchSource", savedSource);
        }

        const validSource = savedSource;
        window.musicApi.setSource(validSource);

        if (sourceSelectCustom) {
            sourceSelectCustom.setValue(currentIndex >= 0 ? currentIndex : 0);
        } else if (typeof CustomSelect !== "undefined") {
            sourceSelectCustom = new CustomSelect(container, sourceNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
                const selectedSourceId = sourceIds[selectedIndex];
                if (selectedSourceId !== window.musicApi.getCurrentSource()) {
                    window.musicApi.setSource(selectedSourceId);
                    window.electronAPI.setConfig("searchSource", selectedSourceId);
                }
            });
        }
    } catch (e) {
        console.error("初始化音源选择器失败:", e);
    }
}

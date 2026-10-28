const DEFAULT_VOLUME = 1;

// 音量配置的内存缓存：visualizer 建 gainNode 时需要同步拿到，不能等 Promise
let savedVolume = DEFAULT_VOLUME;

function clampVolume(value) {
    const vol = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(vol)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, vol));
}

function getSavedVolume() {
    return savedVolume;
}

function applyVolumeToGain(vol) {
    if (window.volumeGainNode) {
        window.volumeGainNode.gain.value = vol;
    }
}

async function loadSavedVolume() {
    try {
        savedVolume = clampVolume(await window.electronAPI.getConfig("volume", DEFAULT_VOLUME));
    } catch (e) {
        console.error("读取保存的音量失败:", e);
        savedVolume = DEFAULT_VOLUME;
    }
    // 配置可能比 AudioContext 建得晚，读到后立刻补齐
    applyVolumeToGain(savedVolume);
    return savedVolume;
}

function setVolume(vol) {
    savedVolume = clampVolume(vol);
    window.electronAPI.setConfig("volume", savedVolume);
    applyVolumeToGain(savedVolume);
}

function initVolumeControl() {
    const container = document.querySelector(".volume-progress-bar");
    if (typeof currentAudio === "undefined" || !container) return;

    loadSavedVolume().then((vol) => {
        new CustomProgressBar(container, vol, setVolume, false);
    });
}

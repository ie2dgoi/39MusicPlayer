let enableVisualizer = true;

function initVisualizer() {
    if (typeof currentAudio === "undefined") {
        console.warn("未找到音频元素");
        return;
    }

    const canvas = document.getElementById("visualizer");
    const ctx = canvas.getContext("2d");

    let audioCtx;
    let analyser;
    let dataArray;
    let source;
    let gainNode;
    let animationFrameId = null;
    const fftSize = 2 ** 11;
    const waveHeight = 0.5;
    let frameHistory = [];
    const maxHistoryTime = 43.9;

    function cleanupVisualizer() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        try {
            source.disconnect();
        } catch (e) {}
        source = null;
        try {
            analyser.disconnect();
        } catch (e) {}
        analyser = null;
        try {
            gainNode.disconnect();
        } catch (e) {}
        gainNode = null;
        window.volumeGainNode = null;

        if (audioCtx && audioCtx.state !== "closed") {
            audioCtx.close().catch((e) => {
                console.warn("关闭 AudioContext 失败:", e);
            });
            audioCtx = null;
        }

        dataArray = null;
        frameHistory = [];
    }

    function initAudioContext() {
        cleanupVisualizer();

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0;
        source = audioCtx.createMediaElementSource(currentAudio);
        source.connect(analyser);
        gainNode = audioCtx.createGain();
        analyser.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Float32Array(bufferLength);
        frameHistory = [];
        window.volumeGainNode = gainNode;
        // 音量来源统一走 volume.js 的配置缓存（原来读 localStorage["playerVolume"]，
        // 那个 key 从来没被写过，所以每次重建 AudioContext 都会把音量拉回 1）
        gainNode.gain.value = typeof getSavedVolume === "function" ? getSavedVolume() : 1;
    }

    function drawSpectrogram() {
        if (!analyser) return;
        analyser.getFloatFrequencyData(dataArray);
        const currentTime = Date.now();
        frameHistory.push({
            time: currentTime,
            data: dataArray.slice(),
        });
        frameHistory = frameHistory.filter((frame) => currentTime - frame.time <= maxHistoryTime);
        const avgFrame = new Float32Array(dataArray.length);
        if (frameHistory.length > 0) {
            const weights = [];
            let weightSum = 0;
            for (let j = 0; j < frameHistory.length; j++) {
                const timeDiff = currentTime - frameHistory[j].time;
                const weight = Math.exp(-timeDiff / 200);
                weights.push(weight);
                weightSum += weight;
            }
            const normalizedWeights = weights.map((w) => w / weightSum);
            for (let i = 0; i < dataArray.length; i++) {
                let sum = 0;
                for (let j = 0; j < frameHistory.length; j++) {
                    sum += frameHistory[j].data[i] * normalizedWeights[j];
                }
                avgFrame[i] = sum;
            }
        }

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!enableVisualizer) return;

        const frame = avgFrame;
        const minDecibels = analyser.minDecibels;
        const maxDecibels = analyser.maxDecibels;
        const range = maxDecibels - minDecibels;

        ctx.imageSmoothingEnabled = true;
        const color = getComputedStyle(document.documentElement).getPropertyValue("--text-1").trim();
        ctx.strokeStyle = color || "#000000";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let f = 0; f < frame.length; f += 1) {
            const x = (1 - (1 - f / frame.length) ** 4) * canvas.width * 1.05;
            const db = frame[f];
            const ratio = (db - minDecibels) / range;
            const y = canvas.height - ratio ** 4 * waveHeight * canvas.height;
            if (f === 0) {
                ctx.lineTo(x, y);
            } else {
                const prevX = (1 - (1 - (f - 1) / frame.length) ** 4) * canvas.width * 1.05;
                const prevDb = frame[f - 1];
                const prevRatio = (prevDb - minDecibels) / range;
                const prevY = canvas.height - prevRatio ** 4 * waveHeight * canvas.height;
                const cpX = (prevX + x) / 2;
                const cpY = (prevY + y) / 2;
                ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.stroke();
    }

    function draw() {
        if (!analyser) return;
        animationFrameId = requestAnimationFrame(draw);
        drawSpectrogram();
    }

    function startVisualizer() {
        if (!audioCtx) {
            initAudioContext();
        } else if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        draw();
    }

    function stopVisualizer() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function handleEnded() {
        stopVisualizer();
    }

    currentAudio.addEventListener("ended", handleEnded);
    currentAudio.addEventListener("play", startVisualizer);
    currentAudio.addEventListener("pause", stopVisualizer);

    if (!currentAudio.paused) {
        startVisualizer();
    }

    window.addEventListener("beforeunload", cleanupVisualizer);
    window.addEventListener("pagehide", cleanupVisualizer);

    window.resetSpectrogram = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameHistory = [];
    };
}

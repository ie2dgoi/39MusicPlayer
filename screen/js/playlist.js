const playlistState = {
    playlists: [],
    curName: null,
    curSongIdx: 0,
};

const PLAY_MODES = {
    SEQUENTIAL: "sequential",
    SHUFFLE: "shuffle",
};
const DEFAULT_PLAY_MODE = PLAY_MODES.SEQUENTIAL;

const PLAY_MODE_ICONS = {
    [PLAY_MODES.SEQUENTIAL]: `
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    `,
    [PLAY_MODES.SHUFFLE]: `
        <path d="m18 14 4 4-4 4" />
        <path d="m18 2 4 4-4 4" />
        <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
        <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
        <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    `,
};

let playMode = DEFAULT_PLAY_MODE;
let shuffleBag = [];
let shuffleHistory = [];

const getCurrentPlaylist = () => {
    if (!playlistState.curName) return { songs: [] };
    const playlist = playlistState.playlists.find((p) => p.name === playlistState.curName);
    return playlist || { songs: [] };
};

const isValidIndex = (idx) => idx >= 0 && idx < getCurrentPlaylist().songs.length;

function getPlayModeLabel() {
    return i18n(playMode === PLAY_MODES.SHUFFLE ? "Shuffle Play" : "Sequential Play");
}

function updatePlayModeUI() {
    const btn = document.getElementById("order-btn");
    if (!btn) return;
    btn.innerHTML = PLAY_MODE_ICONS[playMode];
    btn.classList.toggle("active", playMode === PLAY_MODES.SHUFFLE);
    const label = getPlayModeLabel();
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
}

function setPlayMode(mode) {
    playMode = mode === PLAY_MODES.SHUFFLE ? PLAY_MODES.SHUFFLE : PLAY_MODES.SEQUENTIAL;
    shuffleBag = [];
    shuffleHistory = [];
    updatePlayModeUI();
    try {
        window.electronAPI.setConfig("playMode", playMode);
    } catch (error) {
        console.error("保存播放模式失败:", error);
    }
}

function togglePlayMode() {
    setPlayMode(playMode === PLAY_MODES.SHUFFLE ? PLAY_MODES.SEQUENTIAL : PLAY_MODES.SHUFFLE);
}

async function loadPlayMode() {
    let mode = DEFAULT_PLAY_MODE;
    try {
        mode = await window.electronAPI.getConfig("playMode", DEFAULT_PLAY_MODE);
    } catch (error) {
        console.error("读取播放模式失败:", error);
    }
    playMode = mode === PLAY_MODES.SHUFFLE ? PLAY_MODES.SHUFFLE : PLAY_MODES.SEQUENTIAL;
    updatePlayModeUI();
}

function shuffleArray(list) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function pickShuffleNext() {
    const songs = getCurrentPlaylist().songs;
    if (!songs.length) return null;
    if (songs.length === 1) return songs[0];
    const current = songs[playlistState.curSongIdx];
    shuffleBag = shuffleBag.filter((id) => id !== current && songs.includes(id));
    if (!shuffleBag.length) {
        shuffleBag = shuffleArray(songs.filter((id) => id !== current));
    }
    return shuffleBag.pop() ?? null;
}

function pickShufflePrev() {
    const songs = getCurrentPlaylist().songs;
    if (songs.length <= 1) return songs[0] ?? null;
    const current = songs[playlistState.curSongIdx];
    while (shuffleHistory.length) {
        const id = shuffleHistory.pop();
        if (id !== current && songs.includes(id)) return id;
    }
    return pickShuffleNext();
}

async function playSongl(songId, play = true) {
    const songs = getCurrentPlaylist().songs;
    const index = songs.indexOf(songId);
    if (!isValidIndex(index)) {
        await loadPlaylist("History");
        playSong(songId, play);
        return;
    }
    const prevSongId = songs[playlistState.curSongIdx];
    if (prevSongId && prevSongId !== songId) {
        shuffleHistory.push(prevSongId);
        if (shuffleHistory.length > 100) shuffleHistory.shift();
    }
    playlistState.curSongIdx = index;
    playSong(songId, play);
}

async function playNext() {
    const songs = getCurrentPlaylist().songs;
    if (!songs.length) return;
    if (playMode === PLAY_MODES.SHUFFLE) {
        const next = pickShuffleNext();
        if (!next) return;
        await playSongl(next);
        return;
    }
    const next = songs[(playlistState.curSongIdx + 1) % songs.length];
    await playSongl(next);
}

async function playPrev() {
    const songs = getCurrentPlaylist().songs;
    if (!songs.length) return;
    if (playMode === PLAY_MODES.SHUFFLE) {
        const prev = pickShufflePrev();
        if (!prev) return;
        await playSongl(prev);
        return;
    }
    const prev = songs[(playlistState.curSongIdx - 1 + songs.length) % songs.length];
    await playSongl(prev);
}

async function getPlaylists() {
    const list = await window.electronAPI.getConfig("playlists", []);
    playlistState.playlists = Array.isArray(list)
        ? list.map((p) => ({
              ...p,
              songs: Array.isArray(p.songs) ? [...new Set(p.songs)] : [],
          }))
        : [];
}

async function savePlaylists() {
    await window.electronAPI.setConfig("playlists", playlistState.playlists);
}

function loadPlaylist(name) {
    const exists = playlistState.playlists.some((p) => p.name === name);
    if (!exists) return;
    playlistState.curName = name;
    playlistState.curSongIdx = 0;
    shuffleBag = [];
    shuffleHistory = [];
    updatePlaylistUI();
}

async function addSongToPlaylist(songId, playlistName) {
    const playlist = playlistState.playlists.find((p) => p.name === playlistName);
    if (!playlist) return;
    if (!playlist.songs.includes(songId)) {
        playlist.songs.push(songId);
        await savePlaylists();
        updatePlaylistUI();
    }
}

async function updatePlaylistUI() {
    const container = document.getElementById("playlist-list-container");
    const emptyMsg = document.getElementById("playlist-empty-msg");
    const selector = document.getElementById("playlist-selector-custom");
    if (!container || !selector) return;

    const { playlists, curName } = playlistState;

    const curPlaylistSongs = getCurrentPlaylist().songs;

    if (curPlaylistSongs.length) {
        emptyMsg.style.display = "none";
    } else {
        emptyMsg.style.display = "block";
    }

    selector.innerHTML = "";
    new CustomSelect(
        selector,
        playlists.map((p) => p.name),
        playlists.findIndex((p) => p.name === curName),
        (idx) => {
            loadPlaylist(playlists[idx].name);
        },
    );

    container.innerHTML = "";
    if (curPlaylistSongs.length) {
        for (let i = 0; i < curPlaylistSongs.length; i++) {
            const songId = curPlaylistSongs[i];

            const item = createSongItem(songId, [
                {
                    label: i18n("Delete"),
                    callback: async (id) => {
                        const confirmed = await isConfirm(i18n("Delete Song?"));
                        if (!confirmed) return;
                        const playlist = getCurrentPlaylist();
                        const idx = playlist.songs.indexOf(id);
                        if (idx !== -1) {
                            playlist.songs.splice(idx, 1);
                            savePlaylists().then(() => updatePlaylistUI());
                        }
                    },
                },
            ]);

            container.appendChild(item);
        }
    }
}

async function createPlaylist(name) {
    if (playlistState.playlists.some((p) => p.name === name)) {
        loadPlaylist(name);
        return;
    }
    const playlist = {
        name,
        songs: [],
    };
    playlistState.playlists.push(playlist);
    await savePlaylists();
    loadPlaylist(name);
}

async function handleCreatePlaylist() {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = i18n("Please enter new playlist name");
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const playlistName = inputEl.value.trim();
            const allowedPattern = /^[a-zA-Z0-9\s\-_]+$/;
            if (playlistName && allowedPattern.test(playlistName)) {
                createPlaylist(playlistName);
                inputEl.value = "";
                closeModal();
            } else {
                alert(i18n("Invalid playlist name"));
            }
        }
    });
    showModal(inputEl);
}

async function resolveAllPlaylistIds() {
    let changed = false;

    for (const playlist of playlistState.playlists) {
        const resolved = [];
        for (const songId of playlist.songs) {
            if (!songId.includes("|")) {
                try {
                    const resolvedId = await window.musicApi.resolveId(songId);
                    if (resolvedId !== songId) {
                        resolved.push(resolvedId);
                        changed = true;
                        continue;
                    }
                } catch {}
            }
            resolved.push(songId);
        }
        if (changed) {
            playlist.songs = resolved;
        }
    }

    if (changed) {
        await savePlaylists();
        updatePlaylistUI();
    }
}

async function initPlaylist() {
    await getPlaylists();

    await createPlaylist("History");

    document.getElementById("prev-btn")?.addEventListener("click", playPrev);
    document.getElementById("next-btn")?.addEventListener("click", playNext);
    document.getElementById("order-btn")?.addEventListener("click", togglePlayMode);

    document.getElementById("create-playlist-btn")?.addEventListener("click", handleCreatePlaylist);

    await loadPlayMode();

    resolveAllPlaylistIds();
}

async function addToPlaylist(songId) {
    const title = document.createElement("h1");
    title.textContent = i18n("Select playlist");

    const btns = [];
    playlistState.playlists.forEach((p) => {
        const btn = document.createElement("button");
        btn.textContent = p.name;
        btn.style.cursor = "pointer";
        btn.addEventListener("click", async () => {
            await addSongToPlaylist(songId, p.name);
            closeModal();
        });
        btns.push(btn);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = i18n("Cancel");
    cancelBtn.style.cursor = "pointer";
    cancelBtn.addEventListener("click", closeModal);

    showModal(title, ...btns, cancelBtn);
}

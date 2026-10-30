const API_URL = "https://api.github.com/repos/ie2dgoi/39MusicPlayer/releases";

async function initHomePage() {
    const container = document.getElementById("update-history");

    try {
        showLoading(container);

        const releases = await fetchReleases();
        renderReleases(container, releases);
    } catch (err) {
        console.error("获取发布版本失败:", err);

        container.innerHTML = `
            <div class="error">
                ⚠
            </div>
        `;
    }
}

async function fetchReleases() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            ...
        </div>
    `;
}
function renderReleases(container, releases) {
    container.innerHTML = "";

    const list = document.createElement("div");
    list.className = "update-list";

    releases.forEach((release) => {
        const item = document.createElement("div");
        item.className = "update-item";

        item.innerHTML = `
            <h3>${release.name || release.tag_name}</h3>
            <p class="update-date">
                ${formatDate(release.published_at)}
            </p>
            ${
                release.body
                    ? `
            <div class="update-body">
                ${marked.parse(release.body)}
            </div>`
                    : ""
            }
        `;

        list.appendChild(item);
    });

    container.appendChild(list);
}

function formatDate(dateStr) {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(new Date(dateStr));
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

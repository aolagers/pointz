import { Viewer } from "./viewer";
import { stringifyError } from "./utils";
import { LOCALSTORAGE_KEYS } from "./settings";

window.onerror = (message, source, lineno, colno, error) => {
    document.body.innerHTML =
        `<pre>${JSON.stringify(message)}\n${source} ${lineno}:${colno}` +
        `\n${error ? stringifyError(error) : "-"}</pre>`;
};

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;

const viewer = new Viewer(canvas, window.innerWidth, window.innerHeight);

const toggleDebugButton = document.getElementById("toggle-debug")!;
const debugEl = document.getElementById("debug")!;
toggleDebugButton.addEventListener("click", () => {
    setDebug(!viewer.debug_mode);
});
function setDebug(to: boolean) {
    console.log("DEBUG:", to);
    viewer.debug_mode = to;

    if (viewer.debug_mode) {
        toggleDebugButton.classList.add("active");
        debugEl.style.display = "block";
    } else {
        toggleDebugButton.classList.remove("active");
        debugEl.style.display = "none";
    }

    localStorage.setItem(LOCALSTORAGE_KEYS.DEBUG_MODE, viewer.debug_mode ? "true" : "false");
}

const dbg_s = localStorage.getItem(LOCALSTORAGE_KEYS.DEBUG_MODE);
if (!dbg_s) {
    setDebug(true);
} else {
    setDebug(dbg_s === "true");
}

viewer.addEventListener("loading", (ev) => {
    const el = document.querySelector(".loader") as HTMLElement;
    if (!el) {
        return;
    }
    const n = ev.nodes;
    if (n) {
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
});

viewer.init();

window.addEventListener("resize", () => viewer.setSize(window.innerWidth, window.innerHeight));

document.querySelector("#reset-cam")!.addEventListener("click", () => viewer.econtrols.targetAll());

// viewer.addPointCloud(loadDemo(viewer));

const here = window.location.origin + window.location.pathname.replace(/\/$/, "");
void viewer.addLAZ(here + "/lion_takanawa.copc.laz");

if (window.location.hostname === "localhost") {
    void viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");
} else {
    // void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
    void viewer.addLAZ("https://kartta.aolagers.org/autzen-classified.copc.laz");
}


// void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
// void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/sofi.copc.laz");
// viewer.addLAZ("https://s3.amazonaws.com/data.entwine.io/millsite.copc.laz");
// viewer.addLAZ("http://localhost:5173/sofi.copc.laz");
// viewer.addLAZ("http://localhost:5173/millsite.copc.laz");

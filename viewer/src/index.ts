import { Viewer } from "@pointz/core";

window.onerror = (message, source, lineno, colno, error) => {
    document.body.innerHTML =
        `<pre>${JSON.stringify(message)}\n${source} ${lineno}:${colno}` +
        `\n${error ? stringifyError(error) : "-"}</pre>`;
};

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;

const viewer = new Viewer(canvas, window.innerWidth, window.innerHeight);

const toggleDebugButton = document.getElementById("toggle-debug");
if (toggleDebugButton) {
    toggleDebugButton.addEventListener("click", () => {
        setDebug(!viewer.debug_mode);
    });
}
const toggleMeasureButton = document.getElementById("toggle-measure");
if (toggleMeasureButton) {
    toggleMeasureButton.addEventListener("click", () => {
        if (viewer.econtrols.measure.isActive) {
            viewer.econtrols.measure.stop();
        } else {
            viewer.econtrols.measure.start();
        }
    });
}

const dbg_s = localStorage.getItem("debug_mode");
if (!dbg_s) {
    setDebug(true);
} else {
    setDebug(dbg_s === "true");
}
function setDebug(to: boolean) {
    const debugEl = document.getElementById("debug")!;
    console.log("DEBUG:", to);
    viewer.debug_mode = to;

    if (viewer.debug_mode) {
        toggleDebugButton?.classList.add("active");
        debugEl.style.display = "block";
    } else {
        toggleDebugButton?.classList.remove("active");
        debugEl.style.display = "none";
    }

    localStorage.setItem("debug_mode", viewer.debug_mode ? "true" : "false");
}

viewer.addEventListener("notice", (ev) => {
    const el = document.createElement("div");
    el.classList.add(ev.kind);
    el.innerText = ev.message;
    document.getElementById("notices")?.appendChild(el);
    el.addEventListener("click", () => {
        el.remove();
    });
    setTimeout(() => {
        el.remove();
    }, 5000);
});

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

if (window.location.hostname === "localhost") {
    void viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");
    void viewer.addLAZ(here + "/lion_takanawa.copc.laz");
} else {
    // void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
    void viewer.addLAZ(here + "/assets/lion_takanawa.copc.laz");
    void viewer.addLAZ("https://kartta.aolagers.org/autzen-classified.copc.laz");
}

// void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
// void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/sofi.copc.laz");
// viewer.addLAZ("https://s3.amazonaws.com/data.entwine.io/millsite.copc.laz");
// viewer.addLAZ("http://localhost:5173/sofi.copc.laz");
// viewer.addLAZ("http://localhost:5173/millsite.copc.laz");

function stringifyError(e: unknown) {
    if (e instanceof Error) {
        return JSON.stringify(e, Object.getOwnPropertyNames(e));
    } else if (typeof e === "string") {
        return e;
    } else {
        return JSON.stringify(e);
    }
}

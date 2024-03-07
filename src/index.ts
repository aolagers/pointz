import { Viewer } from "./viewer";
import { stringifyError } from "./utils";

window.onerror = (message, source, lineno, colno, error) => {
    document.body.innerHTML =
        `<pre>${JSON.stringify(message)}\n${source} ${lineno}:${colno}` +
        `\n${error ? stringifyError(error) : "-"}</pre>`;
};

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;

const viewer = new Viewer(canvas, window.innerWidth, window.innerHeight);

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

document.querySelector("#more-points")!.addEventListener("click", () => viewer.loadMoreNodes());
document.querySelector("#less-points")!.addEventListener("click", () => viewer.dropWorstNodes());
document.querySelector("#reset-cam")!.addEventListener("click", () => viewer.econtrols.targetAll());

// viewer.addPointCloud(loadDemo(viewer));

const here = window.location.origin + window.location.pathname.replace(/\/$/, "");
void viewer.addLAZ(here + "/lion_takanawa.copc.laz");

if (window.location.hostname === "localhost") {
    viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");
} else {
    viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
}


// viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/sofi.copc.laz");
// viewer.addLAZ("https://s3.amazonaws.com/data.entwine.io/millsite.copc.laz");
// viewer.addLAZ("http://localhost:5173/sofi.copc.laz");
// viewer.addLAZ("http://localhost:5173/millsite.copc.laz");

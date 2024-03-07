import { Viewer } from "./viewer";
import { loadDemo } from "./demo";

window.onerror = (message, source, lineno, colno, error) => {
    document.body.innerHTML = `<pre>${message}\n${source} ${lineno}:${colno}\n${error}</pre>`;
};

const canvas = document.getElementById("viewer") as HTMLCanvasElement;

const viewer = new Viewer(canvas, window.innerWidth, window.innerHeight);

viewer.init();

// viewer.requestRener();
// viewer.renderLoop();

const demopc = loadDemo(viewer);
viewer.addPointCloud(demopc);

const here = window.location.origin + window.location.pathname.replace(/\/$/, "");
// viewer.addLAZ(here + "/lion_takanawa.copc.laz", true);

if (window.location.hostname === "localhost") {
    viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz", true);
} else {
    viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
}

window.addEventListener("resize", () => {
    viewer.setSize(window.innerWidth, window.innerHeight);
});

// viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/sofi.copc.laz");
// viewer.addLAZ("https://s3.amazonaws.com/data.entwine.io/millsite.copc.laz");
// viewer.addLAZ("http://localhost:5173/sofi.copc.laz");
// viewer.addLAZ("http://localhost:5173/millsite.copc.laz");

import { Viewer } from "@pointz/core";
import { createSignal, For, onMount } from "solid-js";

export function App() {
    const [notices, setNotices] = createSignal<{ kind: string; message: string }[]>([]);

    onMount(() => {
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
            setNotices((prev) => [...prev, { kind: ev.kind, message: ev.message }]);
            // TODO: implement these with solid
            // el.addEventListener("click", () => {
            //     el.remove();
            // });
            // setTimeout(() => {
            //     el.remove();
            // }, 5000);
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
            //void viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");
            // void viewer.addLAZ(here + "/lion_takanawa.copc.laz");
            // void viewer.addLAZ(here + "/490000_7505000.laz.copc.laz");
            void viewer.addLAZ("https://kartta.aolagers.org/urban.copc.laz");
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
    });

    return (
        <>
            <div id="debug" class="nice"></div>

            <div class="loader">
                <svg
                    class="animate-spin h-12 w-12 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            </div>

            <div id="help">
                <p>
                    <span class="font-bold">1</span>: Intensity
                </p>
                <p>
                    <span class="font-bold">2</span>: Classification
                </p>
                <p>
                    <span class="font-bold">3</span>: RGB
                </p>
                <p>
                    <span class="font-bold">+/-</span>: Adjust point size
                </p>
                <p>
                    <span class="">Add files by drag&amp;dropping</span>
                </p>
            </div>

            <div id="notices">
                <For each={notices()}>{(notice) => <div class={"notice " + notice.kind}>{notice.message}</div>}</For>
            </div>

            <canvas id="viewer"></canvas>

            <div id="errormsg" class=""></div>

            <div id="btns" class="">
                <button id="toggle-measure" class="nice btn">
                    measure
                </button>
                <button id="toggle-debug" class="nice btn">
                    debug
                </button>
                <button id="reset-cam" class="nice btn">
                    reset cam
                </button>
            </div>
        </>
    );
}

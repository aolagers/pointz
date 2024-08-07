import { Viewer, type PointCloudInfo } from "@pointz/core";
import { directoryOpen, fileOpen } from "browser-fs-access";
import { createEffect, createSignal, on, onMount } from "solid-js";
import { DoubleSlider } from "./DoubleSlider";
import { Help } from "./Help";
import { Loader } from "./Loader";

import icon_bug from "../assets/bug.svg";
import icon_eye_off from "../assets/eye-off.svg";
import icon_eye from "../assets/eye.svg";
import icon_file_plus from "../assets/file-plus.svg";
import icon_folder_plus from "../assets/folder-plus.svg";
import icon_ruler from "../assets/ruler.svg";
import icon_switch_camera from "../assets/switch-camera.svg";
import icon_x from "../assets/x.svg";

type Notice = {
    kind: "error" | "warn" | "info";
    message: string;
};

export function App() {
    const [theViewer, setTheViewer] = createSignal<Viewer | null>(null);
    const [notices, setNotices] = createSignal<Array<Notice & { created: Number }>>([]);
    const [loading, setLoading] = createSignal(0);
    const [debugMode, setDebugMode] = createSignal(false);
    const [pclouds, setPclouds] = createSignal<PointCloudInfo[]>([]);
    const [coloring, setColoring] = createSignal("RGB");

    const elems: HTMLElement[] = [];

    function updatePositions() {
        let i = 0;
        for (const pc of pclouds()) {
            pc.item.uiLabel = elems[i];
            i++;
        }
    }

    createEffect(on(pclouds, () => updatePositions()));

    // addNotice({ kind: "error", message: "what" });
    // addNotice({ kind: "warn", message: "what the" });
    // addNotice({ kind: "info", message: "what the shit" });

    window.addEventListener("resize", () => theViewer()?.setSize(window.innerWidth, window.innerHeight));

    let debugEl: HTMLElement | undefined = undefined;

    function setDebug(to: boolean) {
        console.log("DEBUG:", to);
        const viewer = theViewer();
        if (!viewer) return;
        viewer.debug_mode = to;
        setDebugMode(to);
        localStorage.setItem("debug_mode", viewer.debug_mode ? "true" : "false");
    }

    function addNotice(ev: Notice) {
        const newNotice = { kind: ev.kind, message: ev.message, created: Math.random() };
        setNotices((prev) => [...prev, newNotice]);
        setTimeout(() => {
            setNotices((prev) => prev.filter((n) => n.created !== newNotice.created));
        }, 5000);
    }

    function toggleMeasure() {
        const viewer = theViewer();
        if (!viewer) return;
        if (viewer.econtrols.measure.isActive) {
            viewer.econtrols.measure.stop();
        } else {
            viewer.econtrols.measure.start();
        }
    }

    function openFile() {
        fileOpen({ multiple: true, extensions: [".laz", ".copc.laz"] }).then((files) => {
            if (!files) return;
            files.forEach((file) => {
                theViewer()?.addLAZ(file);
            });
        });
    }

    async function openDir() {
        const dir = await directoryOpen({ recursive: false });

        console.log("DIR", dir);
        for (const entry of dir) {
            if ("entries" in entry) {
                // is FileSystemDirectoryHandle
                console.log("weirdo", entry);
                for await (const x of entry.entries()) {
                    console.log("*", x);
                }
            } else {
                // is FileSystemDirectoryAndFileHandle
                console.log("duple", entry);
                theViewer()?.addLAZ(entry);
            }
        }
        // for (const y of x) {
        //     if ("directoryHandle" in y) {
        //         theViewer()?.addLAZ(y);
        //     } else {
        //         theViewer()?.addLAZ();
        //     }
        // }
    }

    onMount(() => {
        const canvas = document.querySelector("#viewer") as HTMLCanvasElement;
        const viewer = new Viewer(canvas, window.innerWidth, window.innerHeight);

        setTheViewer(viewer);

        {
            const dbg_s = localStorage.getItem("debug_mode");
            if (!dbg_s) {
                setDebug(true);
            } else {
                setDebug(dbg_s === "true");
            }
        }

        viewer.addEventListener("notice", (ev) => {
            addNotice(ev);
        });

        viewer.addEventListener("loading", (ev) => {
            setLoading(ev.nodes);
        });

        viewer.addEventListener("settings", (ev) => {
            setColoring(ev.color);
        });

        // viewer.addEventListener("message", (ev) => {
        //     setMessages((prev) => [ev.text, ...prev]);
        // });

        viewer.addEventListener("pointclouds", (ev) => {
            setPclouds((prev) => ev.pclouds);
        });

        viewer.init({ debugEl: debugEl });

        const here = window.location.origin + window.location.pathname.replace(/\/$/, "");

        if (window.location.hostname === "localhost") {
            // void viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");
            // void viewer.addLAZ(here + "/lion_takanawa.copc.laz");
            // void viewer.addLAZ(here + "/490000_7505000.laz.copc.laz");
            // void viewer.addLAZ("https://kartta.aolagers.org/urban.copc.laz");
            setLoading(1);
            void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
        } else {
            // void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
            setLoading(1);
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
            <div
                class={
                    "fixed left-2 top-2 z-20 flex items-center gap-2 text-sm text-white transition-opacity duration-500 " +
                    (loading() === 0 ? "opacity-0" : "opacity-100")
                }
            >
                <Loader />

                <div>{loading()}</div>
            </div>

            <Help />

            <div class="fixed left-1/2 z-20 mt-2 flex -translate-x-1/2 transform flex-col gap-1">
                {notices().map((notice, idx) => (
                    <div
                        class="mt-2 w-fit cursor-pointer rounded-sm px-2 py-1 text-sm shadow-md outline outline-black/20 backdrop-blur-xs"
                        classList={{
                            "bg-red-500/70": notice.kind === "error",
                            "bg-blue-500/70": notice.kind === "info",
                            "bg-amber-500/70": notice.kind === "warn",
                        }}
                        onClick={() => setNotices((prev) => prev.filter((_, i) => i !== idx))}
                    >
                        {notice.message}
                    </div>
                ))}
            </div>

            {/* made visible by viewer.init()  */}
            <canvas id="viewer" class="m-0 hidden p-0"></canvas>

            <div class="pointer-events-none fixed right-2 top-2 z-20 flex h-[calc(100dvh-1rem)] flex-col items-end gap-2">
                <div class="pointer-events-auto mb-2 flex gap-2">
                    <button class="nice flex items-center gap-2 hover:bg-black/50" onClick={() => openFile()}>
                        <img class="h-4 invert hover:backdrop-invert-0" src={icon_file_plus} />
                        Add File
                    </button>
                    <button class="nice flex items-center gap-2 hover:bg-black/50" onClick={() => openDir()}>
                        <img class="h-4 invert hover:backdrop-invert-0" src={icon_folder_plus} />
                        Add Folder
                    </button>
                    <button
                        class={
                            "nice flex items-center gap-2 hover:bg-black/50" +
                            (pclouds().length === 0 ? " opacity-20" : "")
                        }
                        disabled={pclouds().length === 0}
                        onClick={() => pclouds().forEach((p) => p.onRemove())}
                        title="Remove all Pointclouds"
                    >
                        <img class="h-4 invert" src={icon_x} />
                    </button>
                </div>

                {pclouds().length > 0 ? (
                    <div class="pointer-events-auto flex flex-col items-end gap-2 bg-transparent text-xs text-white">
                        {/* <div>Pointclouds</div> */}
                        {pclouds().map((pcloud, idx) => (
                            <div
                                class="nice flex items-center pr-1 hover:outline-green-600/70"
                                ref={(el) => (elems[idx] = el)}
                                onMouseEnter={() => pcloud.item.setHighlight(true)}
                                onMouseLeave={() => pcloud.item.setHighlight(false)}
                            >
                                <div onClick={pcloud.onCenter} class="flex cursor-pointer items-center">
                                    <span>{pcloud.name}</span>
                                    <span class="px-2 text-xxs font-bold text-gray-400">
                                        {(pcloud.pointCount / 1_000_000).toFixed(2)}M
                                    </span>
                                </div>

                                <button
                                    onClick={pcloud.onToggleVisibility}
                                    title="Toggle Visibility"
                                    class="px-1 hover:backdrop-invert"
                                >
                                    <img class="h-4 invert" src={pcloud.item.visible ? icon_eye : icon_eye_off} />
                                </button>

                                <button onClick={pcloud.onRemove} title="Remove" class="px-1 hover:backdrop-invert">
                                    <img class="h-4 invert" src={icon_x} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : loading() > 0 ? (
                    <div class="text-xs text-white">Loading...</div>
                ) : (
                    <div class="text-xs text-white">No pointclouds loaded. Drag & Drop a COPC LAZ file.</div>
                )}

                {/* {messages().length > 0 && (
                    <div
                        class="nice flex flex-col gap-1 overflow-y-auto whitespace-pre"
                        onClick={() => setMessages([])}
                    >
                        {messages().join("\n")}
                    </div>
                )} */}

                <div class="-mt-2 flex-1"></div>

                <div class="pointer-events-auto flex flex-col items-end gap-2">
                    <div
                        class={
                            "mb-6 flex items-center gap-2 text-xs text-white " +
                            (coloring() === "INTENSITY" ? "" : "hidden")
                        }
                    >
                        <div class="caps mt-1 font-bold">Intensity:</div>
                        <div>
                            <DoubleSlider onUpdate={(min, max) => theViewer()?.updateIntensityRange(min, max)} />
                        </div>
                    </div>

                    <div
                        onClick={() => setDebug(false)}
                        ref={debugEl}
                        class={"nice text-right text-xs text-white " + (debugMode() ? "" : "hidden")}
                    ></div>

                    <div class="flex gap-2">
                        <button class="nice flex items-center gap-2 hover:bg-black/50" onClick={() => toggleMeasure()}>
                            <img class="h-5 invert" src={icon_ruler} /> Measure
                        </button>
                        <div></div>
                        <button
                            class="nice flex items-center gap-2 hover:bg-black/50"
                            onClick={() => theViewer()?.econtrols.targetAll()}
                        >
                            <img class="h-5 invert" src={icon_switch_camera} /> Reset Camera
                        </button>
                        <button
                            class="nice flex items-center gap-2 hover:bg-black/50"
                            onClick={() => setDebug(!debugMode())}
                        >
                            <img class="h-5 invert" src={icon_bug} /> Debug
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

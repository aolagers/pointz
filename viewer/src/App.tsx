import { Viewer } from "@pointz/core";
import { createSignal, onMount } from "solid-js";
import { Help } from "./Help";
import { Loader } from "./Loader";

type Notice = {
    kind: "error" | "warn" | "info";
    message: string;
};

export function App() {
    const [theViewer, setTheViewer] = createSignal<Viewer | null>(null);
    const [notices, setNotices] = createSignal<Array<Notice & { t: Number }>>([]);
    const [loading, setLoading] = createSignal(0);
    const [showHelp, setShowHelp] = createSignal(!(localStorage.getItem("show_help") === "false"));
    const [debugMode, setDebugMode] = createSignal(false);
    // const [messages, setMessages] = createSignal<string[]>([]);
    const [pclouds, setPclouds] = createSignal<
        Array<{ name: string; pointCount: number; onCenter: () => void; onRemove: () => void }>
    >([]);

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
        const newNotice = { kind: ev.kind, message: ev.message, t: Math.random() };
        setNotices((prev) => [...prev, newNotice]);
        setTimeout(() => {
            setNotices((prev) => prev.filter((n) => n.t !== newNotice.t));
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
            void viewer.addLAZ("https://kartta.aolagers.org/urban.copc.laz");
            // void viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz");
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
            <div
                class={
                    "fixed left-2 top-2 z-20 flex items-center gap-2 text-sm text-white transition-opacity duration-500 " +
                    (loading() === 0 ? "opacity-0" : "opacity-100")
                }
            >
                <Loader />

                <div>{loading()}</div>
            </div>

            <div
                class="fixed bottom-2 left-2 z-20 cursor-pointer"
                onClick={() =>
                    setShowHelp((prev) => {
                        localStorage.setItem("show_help", prev ? "false" : "true");
                        return !prev;
                    })
                }
            >
                {showHelp() ? <Help className="" /> : <div class="text-xs font-bold text-white">?</div>}
            </div>

            <div class="fixed left-1/2 z-20 mt-2 flex -translate-x-1/2 transform flex-col gap-1">
                {notices().map((notice, idx) => (
                    <div
                        class={
                            "mt-2 w-fit cursor-pointer rounded-sm px-2 py-1 text-sm shadow-md outline outline-black/20 backdrop-blur-xs"
                        }
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

            <canvas id="viewer"></canvas>

            <div class="pointer-events-none fixed right-2 top-2 z-20 flex h-[calc(100dvh-1rem)] flex-col items-end gap-2">
                <div class="pointer-events-auto flex gap-1"></div>

                {pclouds().length > 0 && (
                    <div class="nice pointer-events-auto">
                        {pclouds().map((pcloud) => (
                            <div class="flex gap-1">
                                <div onClick={pcloud.onCenter} class="cursor-pointer">
                                    {pcloud.name} ({(pcloud.pointCount / 1_000_000).toFixed(2)}M)
                                </div>

                                <button onClick={pcloud.onRemove}> × </button>
                            </div>
                        ))}
                    </div>
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
                        onClick={() => setDebug(false)}
                        ref={debugEl}
                        class={"text-right text-xs text-white " + (debugMode() ? "" : "hidden")}
                    ></div>

                    <div class="flex gap-2">
                        <button class="nice hover:bg-black/50" onClick={() => toggleMeasure()}>
                            measure
                        </button>
                        <button class="nice hover:bg-black/50" onClick={() => theViewer()?.econtrols.targetAll()}>
                            reset cam
                        </button>
                        <button class="nice hover:bg-black/50" onClick={() => setDebug(!debugMode())}>
                            debug
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

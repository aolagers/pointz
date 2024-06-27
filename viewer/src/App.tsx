import { Viewer } from "@pointz/core";
import { Show, createSignal, onMount } from "solid-js";
import { Help } from "./Help";
import { Loader } from "./Loader";

type Notice = {
    kind: "error" | "warn" | "info";
    message: string;
};

export function App() {
    const [theViewer, setTheViewer] = createSignal<Viewer | null>(null);
    const [notices, setNotices] = createSignal<Array<Notice & { t: Number }>>([]);
    const [loading, setLoading] = createSignal(false);
    const [debugMode, setDebugMode] = createSignal(false);
    const [messages, setMessages] = createSignal<string[]>([]);

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
            setLoading(ev.nodes > 0);
        });

        viewer.addEventListener("message", (ev) => {
            setMessages((prev) => [ev.text, ...prev]);
        });

        viewer.init({ debugEl: debugEl });

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
            <Show when={loading()}>
                <div class="fixed left-2 top-2 z-20">
                    <Loader />
                </div>
            </Show>

            <Help className="fixed bottom-2 left-2 z-20" />

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

            <div class="fixed right-2 top-2 z-20 flex h-[calc(100vh-1rem)] flex-col items-end gap-2">
                <div class="flex gap-1">
                    <button class="nice hover:bg-black/50" onClick={() => toggleMeasure()}>
                        measure
                    </button>
                    <button
                        class="nice hover:bg-black/50"
                        onClick={() => setDebug(!debugMode())}
                        classList={{ "bg-red-900": debugMode() }}
                    >
                        debug
                    </button>
                    <button class="nice hover:bg-black/50" onClick={() => theViewer()?.econtrols.targetAll()}>
                        reset cam
                    </button>
                </div>

                {/* {messages().length > 0 && (
                    <div
                        class="nice flex flex-col gap-1 overflow-y-auto whitespace-pre"
                        onClick={() => setMessages([])}
                    >
                        {messages().join("\n")}
                    </div>
                )} */}

                <div class="-mt-2 flex-1"></div>

                <div ref={debugEl} class={"nice z-20 text-right " + (debugMode() ? "block" : "hidden")}></div>
            </div>
        </>
    );
}

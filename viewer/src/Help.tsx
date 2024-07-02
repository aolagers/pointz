import { createSignal } from "solid-js";

import icon_circle_help from "../assets/circle-help.svg";

const [showHelp, setShowHelp] = createSignal(!(localStorage.getItem("show_help") === "false"));

function key(k: string, desc: string) {
    return (
        <div class="my-1 flex">
            <dt class="mr-1 w-6 rounded-xs px-0.5 py-0 text-center outline outline-1 outline-white/30">{k}</dt>
            <dd>{desc}</dd>
        </div>
    );
}
export function Help() {
    return (
        <div
            class="fixed bottom-2 left-2 z-20 cursor-pointer"
            onClick={() =>
                setShowHelp((prev) => {
                    localStorage.setItem("show_help", prev ? "false" : "true");
                    return !prev;
                })
            }
        >
            {showHelp() ? (
                <div class="text-xs text-white opacity-70">
                    <dl>
                        {key("1", "Intensity")}
                        {key("2", "Classification")}
                        {key("3", "RGB")}
                        {key("+ -", "Adjust point size")}
                        {key("P", "Camera Projection")}
                    </dl>

                    <div class="mt-2">
                        <span class="">Add files by drag&amp;dropping.</span>
                    </div>
                </div>
            ) : (
                <div class="nice text-xs font-bold text-white">
                    <img class="h-5 invert" src={icon_circle_help} />
                </div>
            )}
        </div>
    );
}

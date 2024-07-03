import { render } from "solid-js/web";
import { App } from "./App";

import "./style.css";

const rootEl = document.getElementById("root")!;

render(() => App(), rootEl);

window.onerror = (message, source, lineno, colno, error) => {
    document.body.innerHTML =
        `<pre>${JSON.stringify(message)}\n${source} ${lineno}:${colno}` +
        `\n${error ? stringifyError(error) : "-"}</pre>`;
};

function stringifyError(e: unknown) {
    if (e instanceof Error) {
        return JSON.stringify(e, Object.getOwnPropertyNames(e));
    } else if (typeof e === "string") {
        return e;
    } else {
        return JSON.stringify(e);
    }
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js")
        .then((registration) => {
            console.log("Service Worker registered with scope:", registration.scope);

            registration.addEventListener("updatefound", () => {
                console.log("A new service worker is being installed:", registration.installing);
            });
        })
        .catch((error) => {
            console.error("Service Worker registration failed:", error);
        });
}

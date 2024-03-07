import { Copc } from "copc";

function log(...args: any[]) {
    console.log("Worker:", ...args);
}

onmessage = async function (e: MessageEvent<{ type: "url"; url: string } | { type: "file"; file: File }>) {
    let getter: string | ((begin: number, end: number) => Promise<Uint8Array>);

    if (e.data.type === "url") {
        log("LOAD URL", e.data.url);
        getter = e.data.url;
    } else {
        log("LOAD FILE", e.data.file);
        const file = e.data.file;
        getter = async (begin: number, end: number) => {
            // log("sliced", begin, end);
            const sliced = file.slice(begin, end);
            return new Uint8Array(await sliced.arrayBuffer());
        };
    }

    const copc = await Copc.create(getter);

    log(copc);

    const offset = [...copc.header.offset];

    const bounds = {
        min: [...copc.header.min],
        max: [...copc.header.max],
    };

    const copcHierarchy = await Copc.loadHierarchyPage(getter, copc.info.rootHierarchyPage);

    const MAX = Math.min(2_000_000, copc.header.pointCount);
    const positions = new Float32Array(MAX * 3);
    const colors = new Uint8Array(MAX * 3);

    let ptCount = 0;
    let pIdx = 0;
    let cIdx = 0;

    // TODO: parse classification, pointSource and intensity
    const keys: string[] = [];
    for (const key in copcHierarchy.nodes) {
        keys.push(key);
    }

    keys.sort((a: string, b: string) => {
        return a.localeCompare(b);
    });

    for (const key of keys) {
        const node = copcHierarchy.nodes[key];
        // log("LOAD", key, node);
        if (!node) continue;

        log("node", key, node);

        const view = await Copc.loadPointDataView(getter, copc, node);
        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: view.getter("Red"),
            g: view.getter("Green"),
            b: view.getter("Blue"),
        };

        let div = 1;

        for (let i = 0; i < view.pointCount; i++) {
            positions[pIdx++] = getters.x(i) - offset[0]!;
            positions[pIdx++] = getters.y(i) - offset[1]!;
            positions[pIdx++] = getters.z(i) - offset[2]!;

            // TODO: recognize if 16bit colors or not
            const r = getters.r(i) / div;
            colors[cIdx++] = r;
            colors[cIdx++] = getters.g(i) / div;
            colors[cIdx++] = getters.b(i) / div;

            if (div === 1 && r > 255) {
                div = 256;
            }

            ptCount++;
            if (ptCount >= MAX) {
                break;
            }
        }
        if (ptCount >= MAX) {
            break;
        }
    }

    postMessage(
        { pointCount: ptCount, positions, colors, bounds, offset },
        { transfer: [positions.buffer, colors.buffer] }
    );
};

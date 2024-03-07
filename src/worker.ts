import { Copc } from "copc";

function log(...args: any[]) {
    console.log("Worker:", ...args);
}

onmessage = async function (e: MessageEvent<string>) {
    log("Got message", e.data);

    const url = e.data;

    const copc = await Copc.create(url);

    log(copc);

    const offset = [...copc.header.offset];

    const bounds = {
        min: [...copc.header.min],
        max: [...copc.header.max],
    };

    const copcHierarchy = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);

    const MAX = Math.min(6_000_000, copc.header.pointCount);
    const positions = new Float32Array(MAX * 3);
    const colors = new Uint8Array(MAX * 3);

    let ptCount = 0;
    let pIdx = 0;
    let cIdx = 0;

    // TODO: parse classification, pointSource and intensity

    for (const key in copcHierarchy.nodes) {
        const node = copcHierarchy.nodes[key];
        // log("LOAD", key, node);
        if (!node) continue;

        log("node", key, node);

        const view = await Copc.loadPointDataView(url, copc, node);
        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: view.getter("Red"),
            g: view.getter("Green"),
            b: view.getter("Blue"),
        };

        for (let i = 0; i < view.pointCount; i++) {

            positions[pIdx++] = getters.x(i) - offset[0]!;
            positions[pIdx++] = getters.y(i) - offset[1]!;
            positions[pIdx++] = getters.z(i) - offset[2]!;

            // TODO: recognize if 16bit colors or not
            colors[cIdx++] = getters.r(i) / 256;
            colors[cIdx++] = getters.g(i) / 256;
            colors[cIdx++] = getters.b(i) / 256;

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
        { transfer: [positions.buffer, colors.buffer] },
    );
};

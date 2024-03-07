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

    const MAX = Math.min(2_000_000, copc.header.pointCount);
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);

    const points = [];

    let ptCount = 0;
    let pIdx = 0;
    let cIdx = 0;

    for (const key in copcHierarchy.nodes) {
        const node = copcHierarchy.nodes[key];
        // log("LOAD", key, node);
        if (!node) continue;

        log("node", key, points.at(-1), node);

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
            const point = [
                getters.x(i),
                getters.y(i),
                getters.z(i),
                getters.r(i) / 256,
                getters.g(i) / 256,
                getters.b(i) / 256,
            ] as const;

            points.push(point);

            positions[pIdx++] = getters.x(i) - offset[0]!;
            positions[pIdx++] = getters.y(i) - offset[1]!;
            positions[pIdx++] = getters.z(i) - offset[2]!;

            colors[cIdx++] = getters.r(i) / 256;
            colors[cIdx++] = getters.g(i) / 256;
            colors[cIdx++] = getters.b(i) / 256;

            ptCount++;
            if (ptCount > MAX) {
                break;
            }
        }
        if (ptCount > MAX) {
            break;
        }
    }

    postMessage(
        { pointCount: ptCount, positions, colors, bounds, offset },
        { transfer: [positions.buffer, colors.buffer] },
    );
};

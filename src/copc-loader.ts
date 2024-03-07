import { Copc } from "copc";
import type { Copc as CopcType } from "copc";

export type LazSource = string | File;

export type PointCloudHeader = Pick<CopcType["header"], "min" | "max" | "offset">;

export type WorkerInfoRequest = {
    command: "info";
    source: LazSource;
};

export type Hierarchy = Awaited<ReturnType<typeof Copc.loadHierarchyPage>>;

export type WorkerInfoResponse = {
    msgType: "info";
    header: PointCloudHeader;
    info: CopcType["info"];
    hierarchy: Hierarchy;
};

type WorkerRequest = WorkerInfoRequest | WorkerPointsRequest;

export type CopcNodeInfo = {
    pointCount: number;
    pointDataOffset: number;
    pointDataLength: number;
};

export type WorkerPointsRequest = {
    command: "points";
    source: LazSource;
    offset: number[];
    node: CopcNodeInfo;
};

export type WorkerPointsResponse = {
    msgType: "points";
    pointCount: number;
    positions: Float32Array;
    colors: Uint8Array;
    classifications: Uint8Array;
    intensities: Uint16Array;
    indices: Int32Array;
};

function log(...args: any[]) {
    console.log("%c!! WORKER !!", "color: cyan; font-weight: bold;", ...args);
}

function getGetter(source: LazSource) {
    if (typeof source === "string") {
        return source;
    } else {
        const file: File = source;
        return async (begin: number, end: number) => {
            const sliced = file.slice(begin, end);
            return new Uint8Array(await sliced.arrayBuffer());
        };
    }
}

onmessage = async function (e: MessageEvent<WorkerRequest>) {
    const getter = getGetter(e.data.source);

    const copc = await Copc.create(getter);

    if (e.data.command === "info") {
        log("READ INFO", copc);

        const copcHierarchy = await Copc.loadHierarchyPage(getter, copc.info.rootHierarchyPage);

        const response: WorkerInfoResponse = {
            msgType: "info",
            info: copc.info,
            header: copc.header,
            hierarchy: copcHierarchy,
        };

        postMessage(response);
        return;
    }

    if (e.data.command === "points") {
        const node = e.data.node;

        const view = await Copc.loadPointDataView(getter, copc, node);

        const ptCount = view.pointCount;

        const positions = new Float32Array(ptCount * 3);
        const colors = new Uint8Array(ptCount * 3);
        const classifications = new Uint8Array(ptCount);
        const intensities = new Uint16Array(ptCount);
        const indices = new Int32Array(ptCount);

        const hasRGB = "Red" in view.dimensions && "Green" in view.dimensions && "Blue" in view.dimensions;

        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: hasRGB ? view.getter("Red") : () => 0,
            g: hasRGB ? view.getter("Green") : () => 0,
            b: hasRGB ? view.getter("Blue") : () => 0,
            i: view.getter("Intensity"),
            c: view.getter("Classification"),
        };

        let div = 1;
        let pIdx = 0;
        let cIdx = 0;

        const offset = e.data.offset;

        for (let i = 0; i < view.pointCount; i++) {
            positions[pIdx++] = getters.x(i) - offset[0]!;
            positions[pIdx++] = getters.y(i) - offset[1]!;
            positions[pIdx++] = getters.z(i) - offset[2]!;

            // TODO: recognize if 16bit colors or not
            const r = getters.r(i) / div;
            if (div === 1 && r > 255) {
                div = 256;
            }
            colors[cIdx++] = r;
            colors[cIdx++] = getters.g(i) / div;
            colors[cIdx++] = getters.b(i) / div;

            classifications[i] = getters.c(i);
            intensities[i] = getters.i(i);

            indices[i] = i;
        }

        const response: WorkerPointsResponse = {
            msgType: "points",
            pointCount: view.pointCount,
            positions,
            colors,
            classifications,
            intensities,
            indices,
        };

        postMessage(response, {
            transfer: [positions.buffer, colors.buffer, classifications.buffer, intensities.buffer, indices.buffer],
        });
        return;
    }
};

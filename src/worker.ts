import { Copc } from "copc";
import type { Copc as CopcType } from "copc";

function log(...args: any[]) {
    console.log("%c!! WORKER !!", "color: cyan; font-weight: bold;", ...args);
}

export type PointCloudHeader = CopcType["header"];

export type WorkerResponse =
    | {
          msgType: "info";
          header: PointCloudHeader;
          hierarchy: Awaited<ReturnType<typeof Copc.loadHierarchyPage>>;
      }
    | {
          msgType: "points";
          pointCount: number;
          positions: Float32Array;
          colors: Uint8Array;
          classifications: Uint8Array;
      };

type LazSource = string | File;

export type WorkerRequest =
    | {
          command: "info";
          source: LazSource;
      }
    | {
          command: "load-node";
          source: LazSource;
          offset: number[];
          node: {
              pointCount: number;
              pointDataOffset: number;
              pointDataLength: number;
          };
      };

function getGetter(source: LazSource) {
    if (typeof source === "string") {
        return source;
    } else {
        const file: File = source;
        return async (begin: number, end: number) => {
            // log("sliced", begin, end);
            const sliced = file.slice(begin, end);
            return new Uint8Array(await sliced.arrayBuffer());
        };
    }
}

onmessage = async function (e: MessageEvent<WorkerRequest>) {
    const getter = getGetter(e.data.source);

    const copc = await Copc.create(getter);

    if (e.data.command === "info") {
        log("READ INFO", e.data, getter, copc);

        const copcHierarchy = await Copc.loadHierarchyPage(getter, copc.info.rootHierarchyPage);

        const response: WorkerResponse = {
            msgType: "info",
            header: copc.header,
            hierarchy: copcHierarchy,
        };

        postMessage(response);
        return;
    }

    if (e.data.command === "load-node") {
        const node = e.data.node;
        console.log("LOAD NODE", e.data);

        const view = await Copc.loadPointDataView(getter, copc, node);

        const ptCount = view.pointCount;

        const positions = new Float32Array(ptCount * 3);
        const colors = new Uint8Array(ptCount * 3);
        const classifications = new Uint8Array(ptCount);

        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: view.getter("Red"),
            g: view.getter("Green"),
            b: view.getter("Blue"),
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

            classifications[i] = 0;
        }

        const response: WorkerResponse = {
            msgType: "points",
            pointCount: view.pointCount,
            positions,
            colors,
            classifications,
        };

        postMessage(response, { transfer: [positions.buffer, colors.buffer, classifications.buffer] });
        return;
    }
};

import { Hierarchy } from "./copc-loader";
import { PointCloudNode } from "./pointcloud-node";
import { Queue } from "./queue";

export type OctreePath = [number, number, number, number];

function parentPath(id: OctreePath, steps = 1) {
    if (id[0] - steps < 0) {
        throw new Error("Cannot go up that many steps");
    }
    return [
        id[0] - steps,
        Math.floor(id[1] / Math.pow(2, steps)),
        Math.floor(id[2] / Math.pow(2, steps)),
        Math.floor(id[3] / Math.pow(2, steps)),
    ] as OctreePath;
}

export class Octree {
    items: Record<string, OctreeNode> = {};

    hierarchy: Hierarchy;

    constructor(hierarchy: Hierarchy) {
        this.hierarchy = hierarchy;
    }

    get root() {
        return this.items["0-0-0-0"];
    }

    queue = new Queue<OctreeNode>();

    *enumerate(stillGood: (node: PointCloudNode) => boolean) {
        this.queue.clear();
        this.queue.enqueue(this.root);

        let it: OctreeNode | null = null;

        while ((it = this.queue.dequeue())) {
            if (stillGood(it.node)) {
                yield it.node;

                for (const childID of it.children) {
                    this.queue.enqueue(this.items[childID]);
                }
            }
        }
    }

    initializeRoot(node: PointCloudNode) {
        if (Object.keys(this.items).length > 0) {
            throw new Error("Root node already exists");
        }
        this.items["0-0-0-0"] = new OctreeNode(node);
    }

    add(node: PointCloudNode) {
        const nname = node.nodeName.join("-");
        if (this.items[nname]) {
            throw new Error("Node already exists");
        }

        const parentID = parentPath(node.nodeName);

        const parent = this.items[parentID.join("-")];
        if (parent) {
            parent.children.push(nname);
            this.items[nname] = new OctreeNode(node);
        } else {
            throw new Error(`Parent node does not exist for ${node.nodeName}`);
        }
    }
}

export class OctreeNode {
    node: PointCloudNode;
    hasChild = 0;

    children: string[] = [];

    constructor(node: PointCloudNode) {
        this.node = node;
    }
}

if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;
    it("makes sense", () => {
        const p0 = [0, 0, 0, 0] as OctreePath;
        const p1 = [1, 1, 1, 1] as OctreePath;
        const p2 = [2, 2, 2, 2] as OctreePath;
        const p3 = [3, 4, 4, 4] as OctreePath;

        expect(parentPath(p1)).toEqual(p0);
        expect(parentPath(p2, 2)).toEqual(p0);
        expect(parentPath(p3, 2)).toEqual(p1);
    });
}

import { PointCloudNode } from "./pointcloud-node";

export type OctreePath = [number, number, number, number];

function parentPath(id: OctreePath) {
    return [id[0] - 1, Math.floor(id[1] / 2), Math.floor(id[2] / 2), Math.floor(id[3] / 2)] as OctreePath;
}

export class Octree {
    root?: TreeNode;

    isLoaded = false;

    constructor() {}

    *all() {
        if (this.root) {
            yield* this.root.all();
        }
    }

    add(node: PointCloudNode) {
        if (this.root) {
            this.root.addChild(node);
        } else if (node.nodeName.every((x) => x === 0)) {
            this.root = new TreeNode(node);
        } else {
            throw new Error("Root node must be added first");
        }
    }
}

class TreeNode {
    node: PointCloudNode;

    children: Record<string, TreeNode> = {};

    get depth() {
        return this.node.depth;
    }

    constructor(node: PointCloudNode) {
        this.node = node;
    }

    addChild(node: PointCloudNode) {
        if (this.depth === node.depth - 1) {
            console.info("add", node.nodeName, node);
            this.children[node.nodeName.join("-")] = new TreeNode(node);
        } else {
            let nodeID = node.nodeName;

            // TODO: more efficient child lookup math
            while (nodeID[0] > this.depth + 1) {
                nodeID = parentPath(nodeID);
            }

            const parent = this.children[nodeID.join("-")];
            if (parent) {
                parent.addChild(node);
                console.warn("add", node.nodeName, "indie", parent.node.nodeName);
            } else {
                console.warn("drop", node.nodeName, parentPath(node.nodeName), node);
            }
        }
    }

    // TODO: should be BFS
    // TODO: should have callback to limit depth
    *all(): Generator<PointCloudNode> {
        yield this.node;
        for (const child of Object.values(this.children)) {
            yield* child.all();
        }
    }
}

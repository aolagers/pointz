import { Hierarchy, LazSource } from "./copc-loader";
import { PointCloud } from "./pointcloud";
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
    itemCount = 0;

    hierarchy: Hierarchy;

    parentsWithUnloadedPages: Map<string, string[]> = new Map();

    source: LazSource;

    createNode: (n: OctreePath) => PointCloudNode;

    constructor(hierarchy: Hierarchy, source: LazSource, createNode: (n: OctreePath) => PointCloudNode) {
        this.hierarchy = hierarchy;
        this.source = source;
        this.createNode = createNode;

        // console.log("PAGES", hierarchy.pages, "NODES", hierarchy.nodes);

        this.addUnloadedPages(hierarchy.pages);

        // (window as any).hierarchy = hierarchy;
    }

    get root() {
        return this.items["0-0-0-0"];
    }

    addUnloadedPages(pages: Record<string, { pageOffset: number; pageLength: number } | undefined>) {
        const keys = Object.keys(pages);
        if (keys.length === 0) {
            return;
        }
        console.error("NEW PAGES!!!", keys.length, pages);
        for (const pageID of keys) {
            const parent = parentPath(pageID.split("-").map(Number) as OctreePath);
            const parentID = parent.join("-");
            const existing = this.parentsWithUnloadedPages.get(parentID);
            if (existing) {
                existing.push(pageID);
            } else {
                this.parentsWithUnloadedPages.set(parentID, [pageID]);
            }
        }
    }

    queue = new Queue<OctreeNode>();

    *walk(stillGood: (node: PointCloudNode) => boolean) {
        this.queue.clear();
        this.queue.enqueue(this.root);

        let it: OctreeNode | string | null = null;

        while ((it = this.queue.dequeue())) {
            const nid = it.node.nodeName.join("-");
            const pagesUnderThisOne = this.parentsWithUnloadedPages.get(nid);
            if (pagesUnderThisOne) {
                console.log("node", nid, "has unloaded pages:", pagesUnderThisOne.join(" "));
                for (const pageID of pagesUnderThisOne) {
                    const pageInfo = this.hierarchy.pages[pageID];
                    if (!pageInfo) {
                        // alert("no page info!");
                        console.error("NO PAGE INFO", pageID);
                        continue;
                    }
                    PointCloud.getHierachy(this.source, pageInfo).then((h) => {
                        // console.log("got extra page", pageID, Object.keys(h.nodes).length, Object.keys(h.pages).length, h);

                        for (const nodeID of Object.keys(h.nodes)) {
                            this.hierarchy.nodes[nodeID] = h.nodes[nodeID];
                            if (!this.items[nodeID]) {
                                this.add(this.createNode(nodeID.split("-").map(Number) as OctreePath));
                            }
                            // console.log("added", nodeID, this.itemCount);
                        }

                        this.addUnloadedPages(h.pages);
                    });
                }

                this.parentsWithUnloadedPages.delete(nid);

                // if there are pages that could be the children of this node
                // then we need to load them
                // TODO: do not block here for the full tree
                // TODO: load full tree only when needed
                // const pageQueue: Array<[string, { pageOffset: number; pageLength: number } | undefined]> = [];
                // pageQueue.push(["0-0-0-0", rootHierarchy.pages["0-0-0-0"]]);
                // // pageQueue.push(...Object.entries(rootHierarchy.pages));
                // while (pageQueue.length > 0) {
                //     const pageInfo = pageQueue.pop()!;
                //     if (pageInfo[1]) {
                //         console.log("LOAD EXTRA PAGE", pageInfo[0]);
                //         const h = await PointCloud.getHierachy(source, pageInfo[1]);
                //         for (const nodeID of Object.keys(h.nodes)) {
                //             rootHierarchy.nodes[nodeID] = h.nodes[nodeID];
                //         }
                //         // pageQueue.push(...Object.entries(h.pages));
                //     }
                // }
            }

            if (stillGood(it.node)) {
                yield it.node;

                for (const childID of it.children) {
                    this.queue.enqueue(this.items[childID]);
                }
            }
        }
    }

    initializeRoot(node: PointCloudNode) {
        if (this.itemCount > 0) {
            throw new Error("Root node already exists");
        }
        this.items["0-0-0-0"] = new OctreeNode(node);
        this.itemCount++;
    }

    add(node: PointCloudNode) {
        const nname = node.nodeName.join("-");
        if (this.items[nname]) {
            throw new Error("Node already exists: " + nname);
        }

        const parentID = parentPath(node.nodeName);

        const parent = this.items[parentID.join("-")];
        if (parent) {
            parent.children.push(nname);
            this.items[nname] = new OctreeNode(node);
            this.itemCount++;
        } else {
            throw new Error(`Parent node does not exist for ${nname}`);
        }
    }
}

export class OctreeNode {
    node: PointCloudNode;

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

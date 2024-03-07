import { Box3 } from "three";

export type OctreePath = [number, number, number, number];

export class Octree {
    path: OctreePath;
    bounds: Box3;

    isLoaded: boolean = false;

    constructor(path: OctreePath, bounds: Box3) {
        this.path = path;
        this.bounds = bounds;
    }
}

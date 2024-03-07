import { Camera, EventDispatcher } from "three";

type EventTypes = {
    change: {};
};

export class EarthControls extends EventDispatcher<EventTypes> {
    camera: Camera;
    domElement: HTMLCanvasElement;

    constructor(camera: Camera, element: HTMLCanvasElement) {
        super();

        this.camera = camera;
        this.domElement = element;

        this.domElement.addEventListener("pointermove", (e) => {
            console.log("pointer moved", e);
        });
    }

    onChange() {
        this.dispatchEvent({ type: "change" });
    }
}

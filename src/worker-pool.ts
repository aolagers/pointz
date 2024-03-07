type Wrapper = {
    worker: Worker;
    busy: boolean;
    id: number;
};

export class WorkerPool<R extends Record<string, any>> {
    pool: Wrapper[] = [];
    queue: { request: any; resolve: (resp: any) => void }[] = [];

    running() {
        return this.pool.filter((w) => w.busy).length;
    }
    queued() {
        return this.queue.length;
    }

    constructor(workerUrl: string, poolSize: number) {
        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(workerUrl, { type: "module" });
            const w = {
                worker: worker,
                busy: false,
                id: i,
            };
            this.pool.push(w);
        }

        for (const w of this.pool) {
            console.log("worker", w.id, "busy", w.busy);
        }
    }

    private onTaskFinished(w: Wrapper) {
        const next = this.queue.shift();
        if (next) {
            w.worker.onmessage = async (e) => {
                // await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
                next.resolve(e.data);
                this.onTaskFinished(w);
            };
            w.worker.postMessage(next.request);
        } else {
            w.busy = false;
        }
    }

    async runTask<J extends { command: keyof R }>(req: J): Promise<R[J["command"]]> {
        const available = this.pool.find((w) => !w.busy);

        if (available) {
            available.busy = true;
            return new Promise<R[J["command"]]>((resolve) => {
                available.worker.onmessage = async (e) => {
                    // await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
                    resolve(e.data);

                    this.onTaskFinished(available);
                };
                available.worker.postMessage(req);
            });
        } else {
            return new Promise<R[J["command"]]>((resolve) => {
                this.queue.push({ request: req, resolve });
            });
        }
    }
}

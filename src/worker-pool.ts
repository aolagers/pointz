type Wrapper = {
    worker: Worker;
    busy: boolean;
    id: number;
};

// IDEA: types should be somehow mapped from request to response so that runTask() could return the correct type instead
// of type union

export class WorkerPool<RequestTypes, ResponseTypes> {
    pool: Wrapper[] = [];
    queue: { request: RequestTypes; resolve: (resp: ResponseTypes) => void }[] = [];

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

    onTaskFinished(w: Wrapper) {
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

    async runTask(req: RequestTypes): Promise<ResponseTypes> {
        const available = this.pool.find((w) => !w.busy);

        if (available) {
            available.busy = true;
            return new Promise<ResponseTypes>((resolve) => {
                available.worker.onmessage = async (e) => {
                    // await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
                    resolve(e.data);

                    this.onTaskFinished(available);
                };
                available.worker.postMessage(req);
            });
        } else {
            return new Promise<ResponseTypes>((resolve) => {
                this.queue.push({ request: req, resolve });
            });
        }
    }
}

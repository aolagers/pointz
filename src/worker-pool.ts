type Wrapper = {
    worker: Worker;
    busy: boolean;
    id: number;
};

type QueuedItem = {
    request: unknown;
    resolve: (resp: unknown) => void;
    reject: (resp: unknown) => void;
};

export class WorkerPool<Mappings extends Record<string, { msgType: string }>> {
    pool: Wrapper[] = [];
    queue: QueuedItem[] = [];

    tasksFinished: number = 0;

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
    }

    private onTaskFinished(w: Wrapper) {
        this.tasksFinished++;
        const next = this.queue.shift();
        if (next) {
            w.worker.onmessage = (e: MessageEvent<Mappings[keyof Mappings]>) => {
                if (e.data.msgType === "error") {
                    next.reject(e.data);
                } else {
                    next.resolve(e.data);
                }
                this.onTaskFinished(w);
            };
            w.worker.postMessage(next.request);
        } else {
            w.busy = false;
        }
    }

    async runTask<Job extends { command: keyof Mappings }>(req: Job): Promise<Mappings[Job["command"]]> {
        const available = this.pool.find((w) => !w.busy);

        if (available) {
            available.busy = true;
            return new Promise<Mappings[Job["command"]]>((resolve, reject) => {
                available.worker.onmessage = (e: MessageEvent<Mappings[keyof Mappings]>) => {
                    if (e.data.msgType === "error") {
                        reject(e.data);
                    } else {
                        resolve(e.data);
                    }

                    this.onTaskFinished(available);
                };
                available.worker.postMessage(req);
            });
        } else {
            return new Promise<Mappings[Job["command"]]>((resolve, reject) => {
                this.queue.push({ request: req, resolve: resolve as (_: unknown) => void, reject });
            });
        }
    }
}

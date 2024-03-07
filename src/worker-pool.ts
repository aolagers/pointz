type Wrapper = {
    worker: Worker;
    busy: boolean;
    id: number;
};

type QueuedItem = {
    request: unknown;
    resolve: (resp: any) => void;
    reject: (resp: any) => void;
};

export class WorkerPool<R extends Record<string, any>> {
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
            w.worker.onmessage = async (e) => {
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

    async runTask<J extends { command: keyof R }>(req: J): Promise<R[J["command"]]> {
        const available = this.pool.find((w) => !w.busy);

        if (available) {
            available.busy = true;
            return new Promise<R[J["command"]]>((resolve, reject) => {
                available.worker.onmessage = async (e) => {
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
            return new Promise<R[J["command"]]>((resolve, reject) => {
                this.queue.push({ request: req, resolve, reject });
            });
        }
    }
}

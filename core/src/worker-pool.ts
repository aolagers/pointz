import { EventDispatcher } from "three";
import { PriorityQueue } from "./priority-queue";

type Wrapper = {
    worker: Worker;
    busy: boolean;
    workerID: number;
};

type Request = {
    info: {
        score: number;
    };
    command: unknown;
};

type QueuedItem<Req, Resp> = {
    request: Req;
    resolve: (resp: Resp) => void;
    reject: (resp: Resp) => void;
};

type TEvents = {
    status: { active: number; queued: number };
};

export class WorkerPool<Input extends Request, Output extends { msgType: string }> extends EventDispatcher<TEvents> {
    pool: Wrapper[] = [];
    queue = new PriorityQueue<QueuedItem<Input, Output>>((a, b) => b.request.info.score - a.request.info.score);
    active: Set<Input> = new Set();

    maxWorkers: number;
    workerUrl: string;

    tasksFinished: number = 0;

    running() {
        return this.pool.filter((w) => w.busy).length;
    }

    get queueLength() {
        return this.queue.count();
    }

    dispatchStatus() {
        this.dispatchEvent({ type: "status", active: this.running(), queued: this.queueLength });
    }

    constructor(workerUrl: string, poolSize: number) {
        super();
        this.workerUrl = workerUrl;
        this.maxWorkers = poolSize;
    }

    private addWorker() {
        const i = this.pool.length;
        const worker = new Worker(new URL(this.workerUrl, import.meta.url), { type: "module" });
        const wrapped = {
            worker: worker,
            busy: false,
            workerID: i,
        };
        this.pool.push(wrapped);
        return wrapped;
    }

    private onTaskFinished(w: Wrapper) {
        this.tasksFinished++;
        const next = this.queue.pop();
        if (next) {
            w.worker.onmessage = (e: MessageEvent<Output>) => {
                this.active.delete(next.request);
                if (e.data.msgType === "error") {
                    next.reject(e.data);
                } else {
                    if ("workerID" in e.data) {
                        e.data.workerID = w.workerID;
                    }
                    next.resolve(e.data);
                }
                this.onTaskFinished(w);
            };

            this.active.add(next.request);
            w.worker.postMessage(next.request.command);
        } else {
            w.busy = false;
        }

        this.dispatchStatus();
    }

    rescore(scoringFunc: (input: Input) => number | null) {
        const newQueue = new PriorityQueue<QueuedItem<Input, Output>>(
            (a, b) => b.request.info.score - a.request.info.score
        );

        let item: QueuedItem<Input, Output> | null = null;

        while ((item = this.queue.pop())) {
            const newScore = scoringFunc(item.request);
            if (newScore) {
                item.request.info.score = newScore;
                newQueue.push(item);
            }
        }

        this.queue = newQueue;

        this.dispatchStatus();
    }

    async runTask(req: Input): Promise<Output> {
        const available = this.pool.find((w) => !w.busy);

        if (available) {
            available.busy = true;
            return new Promise<Output>((resolve, reject) => {
                available.worker.onmessage = (e: MessageEvent<Output>) => {
                    this.active.delete(req);
                    if (e.data.msgType === "error") {
                        reject(e.data);
                    } else {
                        if ("workerID" in e.data) {
                            e.data.workerID = available.workerID;
                        }
                        resolve(e.data);
                    }

                    this.onTaskFinished(available);
                };

                this.active.add(req);
                this.dispatchStatus();
                available.worker.postMessage(req.command);
            });
        } else {
            if (this.pool.length < this.maxWorkers) {
                console.log("ADD worker", this.pool.length);
                this.addWorker();
                return this.runTask(req);
            } else {
                return new Promise<Output>((resolve, reject) => {
                    this.queue.push({ request: req, resolve, reject });
                    this.dispatchStatus();
                });
            }
        }
    }
}

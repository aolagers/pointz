export class Queue<T> {
    queue: T[] = [];
    front = 0;
    back = 0;

    size() {
        return this.back - this.front;
    }

    enqueue(item: T) {
        this.queue[this.back++] = item;
    }

    dequeue() {
        if (this.size() === 0) {
            return null;
        }

        const v = this.queue[this.front++];

        if (this.size() === 0 && this.front > 16) {
            console.log("clear on dequeue");
            this.clear();
        }

        return v;
    }

    clear() {
        if (this.back > 16) {
            console.error("clearing queue", this.size(), this.front, this.back);
        }

        this.queue = [];
        this.front = 0;
        this.back = 0;
    }
}

if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;

    it("should enqueue and dequeue items correctly", () => {
        const queue = new Queue<number>();

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);

        expect(queue.dequeue()).toEqual(1);
        expect(queue.dequeue()).toEqual(2);
        expect(queue.dequeue()).toEqual(3);
    });

    it("should return null when dequeueing from an empty queue", () => {
        const queue = new Queue<number>();

        expect(queue.dequeue()).toBeNull();
    });

    it("should return the correct size of the queue", () => {
        const queue = new Queue<number>();

        expect(queue.size()).toEqual(0);

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);

        expect(queue.size()).toEqual(3);

        queue.dequeue();

        expect(queue.size()).toEqual(2);
    });

    it("should clear the queue", () => {
        const queue = new Queue<number>();

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);

        queue.clear();

        expect(queue.size()).toEqual(0);
        expect(queue.dequeue()).toBeNull();
    });
}

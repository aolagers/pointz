export class PriorityQueue<T> {
    private heap: T[];
    private comparator: (a: T, b: T) => number;

    constructor(comparator: (a: T, b: T) => number = (a: T, b: T) => (a > b ? 1 : -1)) {
        this.heap = [];
        this.comparator = comparator;
    }

    private getLeftChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 1;
    }

    private getRightChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 2;
    }

    private getParentIndex(childIndex: number): number {
        return Math.floor((childIndex - 1) / 2);
    }

    private swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    private heapifyUp(): void {
        let index = this.heap.length - 1;
        while (
            this.getParentIndex(index) >= 0 &&
            this.comparator(this.heap[index], this.heap[this.getParentIndex(index)]) < 0
        ) {
            this.swap(index, this.getParentIndex(index));
            index = this.getParentIndex(index);
        }
    }

    private heapifyDown(): void {
        let index = 0;
        while (this.getLeftChildIndex(index) < this.heap.length) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (
                this.getRightChildIndex(index) < this.heap.length &&
                this.comparator(this.heap[this.getRightChildIndex(index)], this.heap[smallerChildIndex]) < 0
            ) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            if (this.comparator(this.heap[index], this.heap[smallerChildIndex]) < 0) {
                break;
            } else {
                this.swap(index, smallerChildIndex);
            }

            index = smallerChildIndex;
        }
    }

    public isEmpty(): boolean {
        return this.heap.length === 0;
    }

    public peek(): T | null {
        if (this.isEmpty()) return null;
        return this.heap[0];
    }

    public push(element: T): void {
        this.heap.push(element);
        this.heapifyUp();
    }

    public popOrThrow(): T {
        if (this.isEmpty()) throw new Error("Priority queue is empty");

        if (this.heap.length === 1) return this.heap.pop()!;
        const item = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.heapifyDown();
        return item;
    }

    public pop(): T | null {
        if (this.isEmpty()) return null;
        return this.popOrThrow();
    }

    public clear() {
        this.heap = [];
    }

    public count() {
        return this.heap.length;
    }
}

if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;

    it("works with custom comparator", () => {
        const pq = new PriorityQueue<string>((a, b) => a.length - b.length);
        pq.push("12345");
        pq.push("x");
        pq.push("abc");
        expect(pq.pop()).toBe("x");
        expect(pq.pop()).toBe("abc");
        expect(pq.pop()).toBe("12345");
        expect(pq.pop()).toBe(null);
    });

    it("order equals sorting an array", () => {
        const arr = Array(100)
            .fill(0)
            .map((_) => Math.random());

        const pq = new PriorityQueue<number>();
        arr.forEach((item) => pq.push(item));

        arr.sort((a, b) => a - b);
        for (const v of arr) {
            expect(v).toEqual(pq.pop());
        }
        expect(pq.pop()).toBe(null);
    });
}

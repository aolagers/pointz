import { createEffect, createSignal } from "solid-js";

export function DoubleSlider(props: { onUpdate: (min: number, max: number) => void }) {
    // TODO: remember previous range
    const [minValue, setMinValue] = createSignal(0);
    const [maxValue, setMaxValue] = createSignal(100);

    createEffect(() => {
        if (minValue() > maxValue()) {
            setMaxValue(minValue());
        }
        if (maxValue() < minValue()) {
            setMinValue(maxValue());
        }
    });

    createEffect(() => {
        const min = minValue() / 100;
        const max = maxValue() / 100;
        props.onUpdate(Math.pow(2, min * 16) / Math.pow(2, 16), Math.pow(2, max * 16) / Math.pow(2, 16));
        // props.onUpdate(min, max);
    });

    return (
        <div class="relative w-44">
            <div class="absolute left-0 right-0 h-1 rounded bg-gray-100/70"></div>
            <div
                class="absolute h-1 rounded bg-blue-500"
                style={`left: ${minValue()}%; right: ${100 - maxValue()}%`}
            ></div>
            <input
                type="range"
                min="0"
                max="100"
                value={minValue()}
                onInput={(e) => setMinValue(Number(e.target.value))}
                class="range-input pointer-events-none absolute left-0 top-0 h-2 w-full appearance-none bg-transparent"
            />
            <input
                type="range"
                min="0"
                max="100"
                value={maxValue()}
                onInput={(e) => setMaxValue(Number(e.target.value))}
                class="range-input pointer-events-none absolute left-0 top-0 h-2 w-full appearance-none bg-transparent"
            />
        </div>
    );
}

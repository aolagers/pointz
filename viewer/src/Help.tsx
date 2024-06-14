export function Help(props: { className?: string }) {
    return (
        <div class={"text-white text-xs " + props.className}>
            <p>
                <span class="font-bold">1</span>: Intensity
            </p>
            <p>
                <span class="font-bold">2</span>: Classification
            </p>
            <p>
                <span class="font-bold">3</span>: RGB
            </p>
            <p>
                <span class="font-bold">+/-</span>: Adjust point size
            </p>
            <p>
                <span class="">Add files by drag&amp;dropping</span>
            </p>
        </div>
    );
}

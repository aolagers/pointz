/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,html}"],
    theme: {
        extend: {
            backdropBlur: {
                xs: "2px",
            },
            fontSize: {
                xxs: ".65rem",
            },
            borderRadius: {
                xs: "0.0625rem",
            },
        },
    },
    safelist: ["label"],
    plugins: [],
};

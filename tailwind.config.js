/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F68048"
        },
        secondary: {
          DEFAULT: "#FF7F11"
        },
        "bg-primary": {
          DEFAULT: "#EAEFEF"
        },
        "bg-secondary": {
          DEFAULT: "#BFC9D1"
        }
      }
    }
  },
  plugins: []
};

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
          DEFAULT: "#850F35"
        },
        secondary: {
          DEFAULT: "#EE6983"
        },
        "bg-primary": {
          DEFAULT: "#f1f2f1"
        },
        "bg-secondary": {
          DEFAULT: "#FCF5EE"
        }
      }
    }
  },
  plugins: []
};

import "../styles/globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ConfirmDialogProvider } from "../contexts/ConfirmDialogContext";

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <ConfirmDialogProvider>
        <Component {...pageProps} />
      </ConfirmDialogProvider>
    </ThemeProvider>
  );
}


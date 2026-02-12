import "../styles/globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ConfirmDialogProvider } from "../contexts/ConfirmDialogContext";
import { BranchProvider } from "../contexts/BranchContext";
import { Toaster } from "react-hot-toast";

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <ConfirmDialogProvider>
        <BranchProvider>
          <Component {...pageProps} />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--toast-bg)',
                color: 'var(--toast-color)',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BranchProvider>
      </ConfirmDialogProvider>
    </ThemeProvider>
  );
}


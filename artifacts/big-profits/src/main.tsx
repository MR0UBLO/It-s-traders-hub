import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { getSocket } from "./lib/socket";

setBaseUrl(import.meta.env.VITE_API_URL);

// Apply the dark theme before the app renders; respect an explicit saved light-theme choice.
try {
  const savedTheme = localStorage.getItem("tradollar_theme");
  document.documentElement.classList.toggle("dark", savedTheme !== "light");
} catch {
  document.documentElement.classList.add("dark");
}

// Connect socket as soon as the app starts
getSocket();

createRoot(document.getElementById("root")!).render(
  <App />
);
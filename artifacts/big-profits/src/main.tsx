import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { getSocket } from "./lib/socket";

setBaseUrl(import.meta.env.VITE_API_URL);

// Connect socket as soon as the app starts
getSocket();

createRoot(document.getElementById("root")!).render(
  <App />
);
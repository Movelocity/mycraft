import { createRoot } from "react-dom/client";
import { initializePwaEvents, registerPwaServiceWorker } from "@/lib/pwa";
import App from "./App";
import "./index.css";

initializePwaEvents();
registerPwaServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// One-time verification log
console.log('[CLIENT FIRST URL]', window.location.href);

createRoot(document.getElementById("root")!).render(<App />);

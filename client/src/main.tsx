import { createRoot } from "react-dom/client";
import { initSentry } from "./sentry";
import App from "./App";
import "./index.css";

// Initialize Sentry error tracking asynchronously
initSentry().catch(() => {
  console.log("Sentry initialization failed, continuing without error tracking");
});

createRoot(document.getElementById("root")!).render(<App />);

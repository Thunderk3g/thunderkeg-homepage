/**
 * Barrel for the app-wide toast system.
 *
 * Usage:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Theme set to Tokyo Night");
 *   toast.error("Agent offline", { description: "LLM_API_KEY not set" });
 *
 * Mount the `<Toaster />` once at the top of the desktop tree.
 */
export { Toaster } from "./Toaster";
export { toast } from "sonner";

// Programmatic entry point. Import the typed Rust engine directly:
//
//   import undo from "@agent-undo/core";
//   undo.init(process.cwd());
//   undo.checkpoint(process.cwd(), "before agent");
//
export { default, type UndoEngine } from "./engine.js";

/**
 * Electron main process.
 *
 * This is the working environment shell (ADR-003). At this step it is a window
 * and nothing else. No data, no PTY, no filesystem access.
 *
 * The security posture below is set now rather than later, because ADR-003 §3
 * is the one constraint in that record marked "does not reopen": the human path
 * and the worker path are separate mechanisms. The renderer is treated as
 * untrusted from the first commit. It has no Node, no remote module, and reaches
 * the main process only through whatever `preload` explicitly exposes.
 *
 * Nothing here spawns a process or touches a path outside the app. When the
 * terminal and file explorer arrive, they arrive as the HUMAN's surfaces
 * (ADR-003 §5, ADR-011), and the worker execution path is built separately.
 *
 * The handlers below are named operations, one per thing the renderer may ask
 * for. Not a general `invoke(channel, ...)` passthrough, which is an open door
 * with a narrow-looking frame. Every one of them is read-only.
 */

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeImage, shell } from "electron";
import {
	answer,
	approvals,
	cost,
	decide,
	draft,
	evaluations,
	events,
	health,
	type LogQuery,
	modelCapabilities,
	objective,
	objectives,
	state,
	stats,
	stopEverything,
	suspensions,
	watch,
} from "./control-plane.ts";

// Before anything reads it. Electron takes the name from productName in
// package.json when packaged, and shows "Electron" when run from source, which
// is what the menu bar and the About panel would otherwise say.
app.setName("Maschina");

const dirname = fileURLToPath(new URL(".", import.meta.url));
const isDev = !app.isPackaged;

function createWindow(): void {
	const window = new BrowserWindow({
		width: 1280,
		height: 832,
		minWidth: 880,
		minHeight: 600,
		show: false,
		backgroundColor: "#0c0d10",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
		trafficLightPosition: { x: 16, y: 20 },
		webPreferences: {
			// .cjs, not .mjs. A sandboxed preload must be CommonJS. See
			// electron.vite.config.ts for why the format is pinned.
			preload: join(dirname, "../preload/index.cjs"),
			// The three that matter. Changing any of them is a security decision,
			// not a convenience one.
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	// The window is told when the log gains something, rather than asking. One
	// watcher per window, stopped when the window goes, so closing a window does
	// not leave a stream open against the control plane.
	const unwatch = watch(
		() => window.webContents.send("log:recorded"),
		(problem) => window.webContents.send("log:trouble", problem),
	);
	window.on("closed", unwatch);

	// Show only once painted, so there is no white flash before the dark theme.
	window.once("ready-to-show", () => window.show());

	// A preload that fails to load leaves the renderer silently powerless: the UI
	// still paints, and every call through the bridge is undefined. Nothing on an
	// authority path may swallow an error, and the preload IS the renderer's
	// authority path. Make it loud.
	window.webContents.on("preload-error", (_event, preloadPath, error) => {
		console.error(`[main] preload failed: ${preloadPath}\n${error.stack ?? error.message}`);
	});

	// Surface renderer console output on stdout in dev, so a runtime error in
	// React is visible without opening devtools.
	if (isDev) {
		window.webContents.on("console-message", (event) => {
			console.log(`[renderer] ${event.message}`);
		});
	}

	// A link in the renderer must never navigate the app window or open a second
	// Electron window. External links go to the real browser; everything else is
	// refused.
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("https://")) void shell.openExternal(url);
		return { action: "deny" };
	});

	const devServer = process.env.ELECTRON_RENDERER_URL;
	if (isDev && devServer !== undefined) {
		void window.loadURL(devServer);
	} else {
		void window.loadFile(join(dirname, "../renderer/index.html"));
	}
}

/**
 * The renderer's entire vocabulary. Adding to this list is a decision about what
 * the window is allowed to know, so it is short on purpose and each entry reads
 * as a question rather than as a channel.
 */
function serveTheRenderer(): void {
	ipcMain.handle("log:events", (_event, query: LogQuery) => events(query ?? {}));
	ipcMain.handle("log:health", () => health());
	ipcMain.handle("objectives:list", () => objectives());
	ipcMain.handle("objectives:one", (_event, id: string) => objective(id));
	ipcMain.handle("objectives:evaluations", (_event, id: string) => evaluations(id));
	ipcMain.handle("objectives:cost", (_event, id: string) => cost(id));
	ipcMain.handle(
		"objectives:state",
		(_event, input: { statement: string; contract: unknown; origin: string }) =>
			state(input.statement, input.contract, input.origin),
	);
	ipcMain.handle(
		"objectives:draft",
		(_event, input: { statement: string; capabilityId: string }) =>
			draft(input.statement, input.capabilityId),
	);
	ipcMain.handle("objectives:drafters", () => modelCapabilities());
	ipcMain.handle("stats:read", () => stats());
	ipcMain.handle("queue:list", () => suspensions());
	ipcMain.handle("queue:approvals", () => approvals());
	ipcMain.handle(
		"queue:decide",
		(
			_event,
			input: { capabilityId: string; granted: boolean; reason: string; approver: string },
		) => decide(input.capabilityId, input.granted, input.reason, input.approver),
	);
	ipcMain.handle("stop:everything", (_event, input: { reason: string; actor: string }) =>
		stopEverything(input.reason, input.actor),
	);
	// The only handler here that changes anything. Named, single purpose, and it
	// takes exactly the four things an answer is made of.
	ipcMain.handle(
		"queue:answer",
		(
			_event,
			input: { worker: string; objective: string | null; because: string; answeredBy: string },
		) => answer(input.worker, input.objective, input.because, input.answeredBy),
	);
}

app.whenReady().then(() => {
	// The dock icon while running from source. A packaged application takes its
	// icon from build/icon.icns and never reaches this, but unpackaged Electron
	// shows its own icon and there is no way to set that except at runtime.
	if (process.platform === "darwin" && isDev) {
		const icon = nativeImage.createFromPath(join(dirname, "../../build/icon.png"));
		if (!icon.isEmpty()) app.dock?.setIcon(icon);
	}

	serveTheRenderer();
	createWindow();

	// macOS: clicking the dock icon with no windows open reopens one.
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

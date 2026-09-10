/**
 * The editor, and the diff.
 *
 * `ADR-011` §8 says an editor is bottomless and that adding one has to be argued
 * for. The argument is in issue #274: reviewing a worker's change in a textarea
 * is not reviewing, and the editor exists so a question about code can be
 * answered where it is asked rather than in another application.
 *
 * **No language workers, and that is the whole shape of the decision.** Monaco
 * splits into two halves. Syntax highlighting is Monarch, on the main thread, and
 * every language it knows is registered by importing the package. Language
 * services are TypeScript, JSON, CSS and HTML running in web workers, and Monaco
 * exports those as functions you call rather than registering them for you. None
 * of them is called here and none ever should be without an ADR, because they are
 * what would need `worker-src` and `blob:` added to a content security policy
 * that is currently closed.
 *
 * So this buys highlighting and a real diff, which is the named problem. It does
 * not buy IntelliSense, which is not.
 *
 * `MonacoEnvironment.getWorker` throws rather than returning something. If a
 * language service is ever added by accident, it fails loudly here instead of
 * quietly asking for a worker the policy will refuse.
 */

// Composed by hand rather than importing the package entry, and the reason is
// mechanical. `monaco-editor` and `languages/register.all.js` both pull in the
// four language SERVICES (TypeScript, CSS, HTML, JSON), which are worker backed.
// Vite emits a worker chunk for anything in the module graph at transform time,
// before tree shaking, so importing either one ships ts.worker, css.worker,
// html.worker and json.worker: four files that must never run under a content
// security policy with no `worker-src`. Naming the parts keeps them out.
//
// `features/register.all.js` is the editor's own contributions (find, folding,
// the diff editor, multi cursor) and pulls no worker at all.
import type * as Monaco from "monaco-editor";
import { editor, KeyCode, KeyMod, Uri } from "monaco-editor/editor.js";
import "monaco-editor/features/register.all.js";

// The languages worth highlighting, named one at a time. Adding one is a line.
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/dockerfile/register.js";
import "monaco-editor/languages/definitions/go/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/ini/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/rust/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
import "monaco-editor/languages/definitions/sql/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/xml/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/scss/register.js";
import "monaco-editor/languages/definitions/graphql/register.js";
import { useEffect, useRef } from "react";

// Monaco declares this global itself. Assigning a thrower rather than leaving it
// undefined is the point: undefined fails somewhere deep with a confusing message.
globalThis.MonacoEnvironment = {
	getWorker(_id: string, label: string): Worker {
		throw new Error(
			`Maschina's editor runs no language workers, and one was asked for (${label}). Adding a language service is an ADR-011 decision, not an import.`,
		);
	},
};

/** Matches the window, so the panel is not a different application inside this one. */
const THEME = "maschina";
editor.defineTheme(THEME, {
	base: "vs-dark",
	inherit: true,
	rules: [],
	colors: {
		"editor.background": "#0c0d10",
		"editor.foreground": "#e6e8ee",
		"editorLineNumber.foreground": "#575c6b",
		"editorLineNumber.activeForeground": "#8b90a0",
		"editorCursor.foreground": "#6f8cff",
		"editor.selectionBackground": "#22252d",
		"editorGutter.background": "#0c0d10",
		"diffEditor.insertedTextBackground": "#4ea36b22",
		"diffEditor.removedTextBackground": "#d0603a22",
	},
});

/** Shared by both, so the editor and the diff cannot drift apart in feel. */
const OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
	theme: THEME,
	fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
	fontSize: 12,
	minimap: { enabled: false },
	scrollBeyondLastLine: false,
	renderWhitespace: "selection",
	automaticLayout: true,
	// The tree is the way around a project. A second one inside the editor would
	// be the beginning of replacing the window with an IDE.
	folding: true,
	lineNumbersMinChars: 3,
};

/**
 * Which grammar to use, where the file name is not enough.
 *
 * Monaco ships JSON only as a worker backed service, so there is no JSON grammar
 * in the half that is kept. JavaScript highlights JSON correctly, so it stands in
 * rather than leaving every package.json and tsconfig.json flat grey.
 */
function languageFor(path: string): string | undefined {
	return /\.jsonc?$/.test(path) ? "javascript" : undefined;
}

/**
 * A file, open and editable.
 *
 * The model is keyed by path so Monaco infers the language from the file name
 * rather than from a table this would otherwise have to keep in step.
 */
export function Code({
	path,
	value,
	onChange,
	onSave,
}: {
	readonly path: string;
	readonly value: string;
	readonly onChange: (next: string) => void;
	readonly onSave: () => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const held = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
	// Read through refs so changing the handler does not tear down the editor.
	const change = useRef(onChange);
	const save = useRef(onSave);
	change.current = onChange;
	save.current = onSave;

	useEffect(() => {
		const element = host.current;
		if (element === null) return;

		const instance = editor.create(element, OPTIONS);
		held.current = instance;
		instance.onDidChangeModelContent(() => change.current(instance.getValue()));
		instance.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => save.current());

		return () => {
			for (const model of editor.getModels()) model.dispose();
			instance.dispose();
			held.current = null;
		};
	}, []);

	// A new file gets a new model rather than having its text replaced, so undo
	// history does not run backwards across two different files.
	useEffect(() => {
		const instance = held.current;
		if (instance === null) return;
		const uri = Uri.file(path);
		const model = editor.getModel(uri) ?? editor.createModel(value, languageFor(path), uri);
		if (model.getValue() !== value) model.setValue(value);
		instance.setModel(model);
	}, [path, value]);

	return <div className="code" ref={host} />;
}

/**
 * What changed, side by side.
 *
 * This is the reason the dependency exists. `08-ENVIRONMENT` §1: a surface fails
 * when it shows state you have to go elsewhere to act on, and a change you cannot
 * read is exactly that.
 */
export function Diff({
	path,
	before,
	after,
}: {
	readonly path: string;
	readonly before: string;
	readonly after: string;
}) {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = host.current;
		if (element === null) return;

		const instance = editor.createDiffEditor(element, {
			...OPTIONS,
			readOnly: true,
			renderSideBySide: true,
			ignoreTrimWhitespace: false,
		});
		const original = editor.createModel(before, languageFor(path), Uri.file(`before/${path}`));
		const modified = editor.createModel(after, languageFor(path), Uri.file(`after/${path}`));
		instance.setModel({ original, modified });

		return () => {
			original.dispose();
			modified.dispose();
			instance.dispose();
		};
	}, [path, before, after]);

	return <div className="code" ref={host} />;
}

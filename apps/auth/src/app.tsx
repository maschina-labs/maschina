import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { safeNext } from "./next.ts";
import type { PeopleApi } from "./people-api.ts";

/**
 * The sign in screens: one small page per thing a person does, drawn like a login screen. Everything that decides
 * anything is the gateway's; this only asks it and shows the answer in words. The session is a cookie the gateway
 * sets and the browser keeps, so nothing here holds one.
 */

export type AuthAppProps = {
	path: string;
	search: string;
	api: PeopleApi;
	/** Where a person goes when no other Maschina address was asked for. */
	appUrl: string;
	/** This site's own address, which the emailed links come back to. */
	origin: string;
	/** Leaves for another address. Passed in so a test can see where it would go. */
	go: (address: string) => void;
};

const MIN_PASSWORD = 10;
const TOO_SHORT = `Use a password of at least ${MIN_PASSWORD} characters.`;

export function AuthApp(props: AuthAppProps) {
	const params = new URLSearchParams(props.search);
	const asked = params.get("next");
	const next = safeNext(asked, props.appUrl);
	const keep = asked ? `?next=${encodeURIComponent(asked)}` : "";

	switch (props.path.replace(/\/+$/, "")) {
		case "/sign-up":
			return <SignUp {...props} next={next} keep={keep} />;
		case "/forgot":
			return <Forgot {...props} />;
		case "/reset":
			return <Reset {...props} token={params.get("token")} />;
		case "/verified":
			return <Verified next={next} />;
		default:
			return <SignIn {...props} next={next} keep={keep} />;
	}
}

/** The page's name is its heading and its browser tab, in Title Case, like every page name on the site. */
function Frame({ title, children }: { title: string; children: ReactNode }) {
	useEffect(() => {
		document.title = `${title} | Maschina`;
	}, [title]);
	return (
		<main className="flex min-h-svh items-center justify-center bg-black px-6 py-16 font-display text-neutral-200">
			<div className="w-full max-w-sm">
				<a href="/" aria-label="Maschina">
					<img src="/brand/wordmark.svg" alt="" className="mb-10 h-5 w-auto" />
				</a>
				<h1 className="mb-6 text-2xl font-medium text-white">{title}</h1>
				{children}
			</div>
		</main>
	);
}

function Field(props: {
	label: string;
	type?: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete?: string;
}) {
	const id = useId();
	return (
		<div className="mb-4">
			<label
				htmlFor={id}
				className="mb-1.5 block text-[11px] tracking-widest text-neutral-400 uppercase"
			>
				{props.label}
			</label>
			<input
				id={id}
				type={props.type ?? "text"}
				value={props.value}
				autoComplete={props.autoComplete}
				onChange={(event) => props.onChange(event.target.value)}
				className="h-11 w-full border border-white/15 bg-white/[0.04] px-3 text-white outline-none focus:border-white/60"
			/>
		</div>
	);
}

const primary =
	"h-11 w-full bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50";
const secondary =
	"h-11 w-full border border-white/15 bg-white/[0.04] px-4 text-sm text-white hover:bg-white/10 disabled:opacity-50";
const quiet = "text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline";

function Problem({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p
			role="alert"
			className="mb-4 border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200"
		>
			{message}
		</p>
	);
}

function SignIn({ api, next, keep, appUrl, go }: AuthAppProps & { next: string; keep: string }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [company, setCompany] = useState(false);
	const [workEmail, setWorkEmail] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setProblem(null);
		const done = await api.signInEmail(email, password);
		if (done.ok) return go(next);
		setProblem(done.message);
		setBusy(false);
	}

	async function leaveFor(
		start: Promise<{ ok: true; url: string } | { ok: false; message: string }>,
	) {
		setProblem(null);
		const done = await start;
		if (done.ok) return go(done.url);
		setProblem(done.message);
	}

	return (
		<Frame title="Sign In">
			<Problem message={problem} />
			<form onSubmit={submit}>
				<Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
				<Field
					label="Password"
					type="password"
					value={password}
					onChange={setPassword}
					autoComplete="current-password"
				/>
				<button type="submit" disabled={busy} className={primary}>
					Sign in
				</button>
			</form>
			<p className="mt-3 text-right">
				<a href="/forgot" className={quiet}>
					Forgot your password?
				</a>
			</p>

			<div className="my-6 flex items-center gap-3 text-[11px] tracking-widest text-neutral-500 uppercase">
				<span className="h-px flex-1 bg-white/10" />
				or
				<span className="h-px flex-1 bg-white/10" />
			</div>

			<div className="flex flex-col gap-2">
				<button
					type="button"
					className={secondary}
					onClick={() => leaveFor(api.startSocial("google", next))}
				>
					Continue with Google
				</button>
				<button
					type="button"
					className={secondary}
					onClick={() => leaveFor(api.startSocial("github", next))}
				>
					Continue with GitHub
				</button>
				<a href={`${appUrl}/sign-in`} className={`${secondary} flex items-center justify-center`}>
					Continue with a wallet
				</a>
				{company ? (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void leaveFor(api.startSso(workEmail, next));
						}}
						className="mt-2"
					>
						<Field
							label="Work email"
							type="email"
							value={workEmail}
							onChange={setWorkEmail}
							autoComplete="email"
						/>
						<button type="submit" className={primary}>
							Continue
						</button>
					</form>
				) : (
					<button type="button" className={secondary} onClick={() => setCompany(true)}>
						Sign in with your company
					</button>
				)}
			</div>

			<p className="mt-8 text-sm text-neutral-400">
				New here?{" "}
				<a href={`/sign-up${keep}`} className="text-white underline underline-offset-4">
					Create an account
				</a>
			</p>
		</Frame>
	);
}

function SignUp({ api, next, keep, origin }: AuthAppProps & { next: string; keep: string }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (password.length < MIN_PASSWORD) return setProblem(TOO_SHORT);
		setBusy(true);
		setProblem(null);
		const done = await api.signUpEmail(
			name,
			email,
			password,
			`${origin}/verified?next=${encodeURIComponent(next)}`,
		);
		if (done.ok) return setSentTo(email);
		setProblem(done.message);
		setBusy(false);
	}

	if (sentTo) {
		return (
			<Frame title="Check Your Email">
				<p className="text-neutral-300">
					We sent a link to <span className="text-white">{sentTo}</span>. Open it to confirm the
					address, then you are in.
				</p>
				<p className="mt-6 text-sm text-neutral-400">
					Nothing there?{" "}
					<a href={`/sign-in${keep}`} className="text-white underline underline-offset-4">
						Back to sign in
					</a>
				</p>
			</Frame>
		);
	}

	return (
		<Frame title="Sign Up">
			<Problem message={problem} />
			<form onSubmit={submit}>
				<Field label="Name" value={name} onChange={setName} autoComplete="name" />
				<Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
				<Field
					label="Password"
					type="password"
					value={password}
					onChange={setPassword}
					autoComplete="new-password"
				/>
				<button type="submit" disabled={busy} className={primary}>
					Create account
				</button>
			</form>
			<p className="mt-8 text-sm text-neutral-400">
				Already have one?{" "}
				<a href={`/sign-in${keep}`} className="text-white underline underline-offset-4">
					Sign in
				</a>
			</p>
		</Frame>
	);
}

function Forgot({ api, origin }: AuthAppProps) {
	const [email, setEmail] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setProblem(null);
		const asked = await api.requestReset(email, `${origin}/reset`);
		if (asked.ok) return setDone(true);
		setProblem(asked.message);
	}

	return (
		<Frame title="Forgot Password">
			{done ? (
				<p className="text-neutral-300">
					If there is an account with that email, we sent it a link to choose a new password.
				</p>
			) : (
				<>
					<Problem message={problem} />
					<form onSubmit={submit}>
						<Field
							label="Email"
							type="email"
							value={email}
							onChange={setEmail}
							autoComplete="email"
						/>
						<button type="submit" className={primary}>
							Send the link
						</button>
					</form>
				</>
			)}
			<p className="mt-8 text-sm">
				<a href="/sign-in" className={quiet}>
					Back to sign in
				</a>
			</p>
		</Frame>
	);
}

function Reset({ api, token }: AuthAppProps & { token: string | null }) {
	const [password, setPassword] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	if (!token) {
		return (
			<Frame title="Reset Password">
				<Problem message="That link is not complete. Ask for a new one." />
				<a href="/forgot" className={quiet}>
					Ask for a new link
				</a>
			</Frame>
		);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (password.length < MIN_PASSWORD) return setProblem(TOO_SHORT);
		setProblem(null);
		const saved = await api.resetPassword(token as string, password);
		if (saved.ok) return setDone(true);
		setProblem(saved.message);
	}

	return (
		<Frame title="Reset Password">
			{done ? (
				<>
					<p className="mb-6 text-neutral-300">Your password is changed. Sign in with it.</p>
					<a href="/sign-in" className={`${primary} flex items-center justify-center`}>
						Sign in
					</a>
				</>
			) : (
				<>
					<Problem message={problem} />
					<form onSubmit={submit}>
						<Field
							label="New password"
							type="password"
							value={password}
							onChange={setPassword}
							autoComplete="new-password"
						/>
						<button type="submit" className={primary}>
							Save the password
						</button>
					</form>
				</>
			)}
		</Frame>
	);
}

function Verified({ next }: { next: string }) {
	return (
		<Frame title="Email Confirmed">
			<p className="mb-6 text-neutral-300">That address is yours now, and you are signed in.</p>
			<a href={next} className={`${primary} flex items-center justify-center`}>
				Continue
			</a>
		</Frame>
	);
}

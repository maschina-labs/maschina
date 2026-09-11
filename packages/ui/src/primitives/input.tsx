import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

const field =
	"w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-ghost transition-colors hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-40";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
	// Spellcheck off by default: every input in this application holds a path, an
	// address, an identifier or code, and red squiggles under all of it is noise.
	return <input spellCheck={false} className={cn(field, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			spellCheck={false}
			className={cn(field, "resize-none font-mono leading-relaxed", className)}
			{...rest}
		/>
	);
}

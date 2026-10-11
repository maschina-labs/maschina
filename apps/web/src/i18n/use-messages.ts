import { useLocale } from "./locale-context.tsx";
import { type Messages, messagesFor } from "./messages.ts";

/** The words of the page being shown, in its language. */
export const useMessages = (): Messages => messagesFor(useLocale());

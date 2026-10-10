import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type LocaleCode } from "./locales.ts";

/** The language of the page being shown, for whatever needs it below. English where nothing says otherwise. */
export const LocaleContext = createContext<LocaleCode>(DEFAULT_LOCALE);
export const useLocale = () => useContext(LocaleContext);

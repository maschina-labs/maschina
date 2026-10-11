export {
	type Accounts,
	type AccountsOptions,
	createAccounts,
	PEOPLE_PATH,
	PERSON_COOKIE_PREFIX,
	type PersonRef,
	type SocialProvider,
} from "./accounts.ts";
export { type Mail, type Mailer, resendMailer, resetMail, verificationMail } from "./mail.ts";

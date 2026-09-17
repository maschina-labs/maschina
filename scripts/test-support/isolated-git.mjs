/**
 * Makes git in tests act only on the repositories the tests create.
 *
 * Git hooks run with GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE and similar set. A test that inherits them
 * sends its git commands to the real repository instead of its temporary one. Call this at the top of
 * any test file that runs git.
 */
export function isolateGit(env = process.env) {
	for (const name of Object.keys(env)) {
		if (name.startsWith("GIT_")) delete env[name];
	}
	// Keep the machine's own git config (signing, hooks, aliases) out of test repositories.
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_NOSYSTEM = "1";
	return env;
}

-- A paper machine has no signing key, and the database is what says so.
--
-- Every machine used to be provisioned the same way: a real wallet at the provider, a vault beside
-- it, and two policies pinned to the owner's own address. For a machine that only ever pretends to
-- trade that is pure cost, and it made paper impossible for anybody who had not linked a wallet of
-- their own, because there was no address for a policy to pin funds to. Which meant "try it on
-- paper, no money at risk" was not true for anybody on a phone.
--
-- So a paper machine now carries the provider 'paper': an address generated once with its key thrown
-- away on the spot. It cannot sign, not because anything refuses it, but because nobody anywhere
-- holds the key. The existing providers are untouched, and machines already written keep theirs.

ALTER TABLE "machines" DROP CONSTRAINT "machines_provider_known";--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_provider_known"
	CHECK ("provider" in ('turnkey', 'crossmint', 'paper'));--> statement-breakpoint

-- The rule that matters. A machine that holds real money may never carry a wallet that cannot sign,
-- whatever any code path believes it is doing. `paper` itself never changes after a machine is made
-- (0022), so a machine cannot acquire real money and keep an unsignable wallet either.
ALTER TABLE "machines" ADD CONSTRAINT "machines_paper_provider_is_paper_only"
	CHECK ("provider" <> 'paper' or "paper");

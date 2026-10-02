declare module "virtual:papers" {
	const papers: import("./lib/papers.ts").PaperListing[];
	export default papers;
}

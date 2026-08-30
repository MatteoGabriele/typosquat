/**
 * GitHub Apps and service accounts that appear on most repositories.
 * This is especially dangerous when a fake account like `depenbadot`, with an avatar identical
 * to the original one, tries to open a fake package update with potential malware.
 *
 * Should be a list constantly updated and maintained by the community itself.
 */
export const TRUSTED_BOTS: readonly string[] = [
	"dependabot[bot]",
	"github-actions[bot]",
	"renovate[bot]",
	"codecov[bot]",
	"stale[bot]",
	"imgbot[bot]",
	"netlify[bot]",
	"vercel[bot]",
	"greenkeeper[bot]",
	"codeclimate[bot]",
	"changeset-bot[bot]",
	"semantic-release-bot",
	"snyk-bot",
	"codecov-io",
	"github-actions",
];

/**
 * Known maintainer names.
 *
 * This is especially useful for unreadable names: `yyx990803` and `43081j`
 * which are impossible to verify at a glance.
 *
 * Should be a list constantly updated and maintained by the community itself.
 */
export const TRUSTED_PEOPLE: readonly string[] = [
	"yyx990803",
	"antfu",
	"patak-dev",
	"patak-cat",
	"posva",
	"danielroe",
	"Atinux",
	"bluwy",
	"dominikg",
	"Rich-Harris",
	"gaearon",
	"kentcdodds",
	"TkDodo",
	"tannerlinsley",
	"sokra",
	"Boshen",
	"egoist",
	"mcollina",
	"sindresorhus",
	"43081j",
	"ghostdevv",
	"huang-julien",
	"gameroman",
	"sheremet-va",
	"ematipico",
	"graphieros",
	"MatteoGabriele",
	"TheAlexLichter",
	"trueberryless",
	"wojtekmaj",
	"serhalp",
	"alexdln",
	"shuuji3",
];

/** Everything the action defends out of the box. */
export const TRUSTED: readonly string[] = [...TRUSTED_BOTS, ...TRUSTED_PEOPLE];

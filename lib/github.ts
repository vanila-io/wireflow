// The repository's GitHub star count, for the landing page. Fetched on the
// server when "/" is generated (at build, then at most hourly), never from the
// visitor's browser. Unauthenticated: 60 requests an hour per IP, far more
// than one an hour needs. See lib/remote-data.ts for what happens on failure.
import { unavailable } from "./remote-data";

export const REPO = "vanila-io/wireflow";
export const REPO_URL = `https://github.com/${REPO}`;
export const API_URL = `https://api.github.com/repos/${REPO}`;
export const REVALIDATE_SECONDS = 3600;

type Fetch = typeof fetch;

export async function fetchStars(fetcher: Fetch = fetch): Promise<number> {
  const res = await fetcher(API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub refuses API requests without one (workerd sends none by default).
      "User-Agent": "wireflow.co landing page (github.com/vanila-io/wireflow)",
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status}`);
  const stars = ((await res.json()) as { stargazers_count?: unknown }).stargazers_count;
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 0) {
    throw new Error("GitHub API answered without a star count");
  }
  return stars;
}

/** The star count, or null (the page then shows no number) if GitHub can't be read during the build. */
export async function getStars(fetcher: Fetch = fetch): Promise<number | null> {
  try {
    return await fetchStars(fetcher);
  } catch (error) {
    return unavailable(null, `GitHub stars: ${(error as Error).message}`);
  }
}

export const formatCount = (n: number) => new Intl.NumberFormat("en-US").format(n);

export type ReleaseAvailabilityHealth = "loading" | "current" | "withdrawn" | "unavailable";

export interface ReleaseAvailability {
  readonly health: ReleaseAvailabilityHealth;
  readonly reason: string | null;
}

export const INITIAL_RELEASE_AVAILABILITY: ReleaseAvailability;

export function loadReleaseAvailability(options: {
  readonly manifestUrl: string;
  readonly expectedReleaseId: string;
  readonly expectedManifestPath: string;
  readonly expectedManifestSha256: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<ReleaseAvailability>;

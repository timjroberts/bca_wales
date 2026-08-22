export const INITIAL_RELEASE_AVAILABILITY = { health: "loading", reason: null };

const unavailable = { health: "unavailable", reason: null };

export async function loadReleaseAvailability({
  manifestUrl,
  expectedReleaseId,
  expectedManifestPath,
  expectedManifestSha256,
  fetchImpl = fetch
}) {
  try {
    const response = await fetchImpl(manifestUrl, { cache: "no-store" });
    if (!response.ok) return unavailable;
    const document = await response.json();

    if (document?.status === "withdrawn") {
      return {
        health: "withdrawn",
        reason: typeof document.reason === "string" && document.reason.trim() ? document.reason.trim() : null
      };
    }

    if (document?.status === "current") {
      const expectedManifestUrl = new URL(expectedManifestPath, manifestUrl).href;
      if (
        document.schema_version !== "1.0.0" ||
        document.release_id !== expectedReleaseId ||
        document.manifest_sha256 !== expectedManifestSha256 ||
        document.manifest_url !== expectedManifestUrl
      ) return unavailable;
      return { health: "current", reason: null };
    }

    if (
      document?.release_id === expectedReleaseId &&
      document?.gate?.result === "pass" &&
      Array.isArray(document.gate.hard_failures) &&
      document.gate.hard_failures.length === 0
    ) return { health: "current", reason: null };

    return unavailable;
  } catch {
    return unavailable;
  }
}

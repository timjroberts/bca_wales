export const EMPTY_PUBLICATION = {
  status: "unavailable",
  message: "No evidence release has been promoted to this foundation yet."
} as const;

export interface AssetReference {
  readonly assetId: string;
  readonly mediaType: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ReleaseManifest {
  readonly schemaVersion: "1.0.0";
  readonly releaseId: string;
  readonly datasetVersion: string;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly registryCommit: string;
  readonly codeCommit: string;
  readonly assets: readonly AssetReference[];
}

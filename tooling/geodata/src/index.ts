export interface ImmutableBuildTarget {
  readonly releaseId: string;
  readonly stagingDirectory: string;
  readonly outputDirectory: string;
}

export interface GeodataBuildStep {
  readonly id: string;
  readonly toolVersion: string;
  run(target: ImmutableBuildTarget): Promise<void>;
}

export const IMMUTABLE_OUTPUT_RULE =
  "A build writes a new versioned release path and never mutates a promoted release.";

export type OutputProfile =
  | "geojson"
  | "vector_pmtiles"
  | "raster_pmtiles"
  | "cog"
  | "accessible_csv"
  | "accessible_json";

export interface PublicationAssetContract {
  readonly assetId: string;
  readonly datasetId: string;
  readonly path: string;
  readonly mediaType: string;
  readonly profile: OutputProfile;
  readonly visibility: "public" | "private";
}

export interface PublicationGateResult {
  readonly result: "pass" | "fail";
  readonly hardFailures: readonly string[];
  readonly warnings: readonly string[];
  readonly checks: readonly {
    readonly id: string;
    readonly result: "pass" | "fail" | "warning";
    readonly message: string;
  }[];
}

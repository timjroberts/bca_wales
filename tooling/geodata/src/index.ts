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

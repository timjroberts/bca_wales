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

export type FixtureMapStyle = "fire" | "change" | "protected" | "access" | "water" | "habitat";

export interface ExplorerFixtureDate {
  readonly id: string;
  readonly label: { readonly en: string; readonly cy: string };
  readonly displayDate: { readonly en: string; readonly cy: string };
}

export interface ExplorerFixtureLayer {
  readonly id: string;
  readonly groupId: string;
  readonly name: { readonly en: string; readonly cy?: string };
  readonly description: { readonly en: string; readonly cy?: string };
  readonly classification: "authoritative" | "provisional" | "derived" | "contextual" | "historical";
  readonly defaultVisible: boolean;
  readonly mapStyle: FixtureMapStyle;
  readonly temporal: boolean;
  readonly provider: string;
  readonly attribution: string;
  readonly evidenceStatus: { readonly en: string; readonly cy: string };
  readonly sourceDate: { readonly en: string; readonly cy: string };
  readonly licence: string;
  readonly method: { readonly en: string; readonly cy?: string };
  readonly limitations: readonly { readonly en: string; readonly cy?: string }[];
}

export interface ExplorerFixture {
  readonly schemaVersion: "1.0.0";
  readonly fixture: true;
  readonly fixtureNotice: { readonly en: string; readonly cy: string };
  readonly map: {
    readonly center: readonly [number, number];
    readonly zoom: number;
    readonly features: {
      readonly type: "FeatureCollection";
      readonly features: readonly unknown[];
    };
  };
  readonly dates: readonly ExplorerFixtureDate[];
  readonly groups: readonly {
    readonly id: string;
    readonly name: { readonly en: string; readonly cy: string };
    readonly description: { readonly en: string; readonly cy: string };
  }[];
  readonly layers: readonly ExplorerFixtureLayer[];
}

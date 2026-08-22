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

export type ExplorerMapStyle =
  | "thermal"
  | "fire"
  | "change"
  | "ndvi"
  | "ndmi"
  | "protected"
  | "access"
  | "water"
  | "terrain"
  | "habitat";

export interface ExplorerDate {
  readonly id: string;
  readonly label: { readonly en: string; readonly cy: string };
  readonly displayDate: { readonly en: string; readonly cy: string };
  readonly validAoiPercent: number;
}

export interface ExplorerLayer {
  readonly id: string;
  readonly groupId: string;
  readonly name: { readonly en: string; readonly cy?: string };
  readonly description: { readonly en: string; readonly cy?: string };
  readonly classification: "authoritative" | "provisional" | "derived" | "contextual" | "historical";
  readonly defaultVisible: boolean;
  readonly mapStyle: ExplorerMapStyle;
  readonly selectionGroup?: string;
  readonly temporal: boolean;
  readonly provider: string;
  readonly attribution: string;
  readonly evidenceStatus: { readonly en: string; readonly cy: string };
  readonly sourceDate: { readonly en: string; readonly cy: string };
  readonly licence: string;
  readonly owner: string;
  readonly nextReviewAt: string;
  readonly method: { readonly en: string; readonly cy?: string };
  readonly limitations: readonly { readonly en: string; readonly cy?: string }[];
  readonly accessibleDownload?: string;
  readonly legend?: {
    readonly unit: { readonly en: string; readonly cy: string };
    readonly stops: readonly number[];
    readonly colours: readonly string[];
    readonly low: { readonly en: string; readonly cy: string };
    readonly high: { readonly en: string; readonly cy: string };
    readonly notObserved: { readonly en: string; readonly cy: string };
  };
}

export interface ExplorerRelease {
  readonly schemaVersion: "1.0.0";
  readonly fixture: false;
  readonly release: {
    readonly id: string;
    readonly datasetVersion: string;
    readonly publishedAt: string | null;
    readonly preparedAt: string;
    readonly retrievedAt: string;
    readonly nextReviewAt: string;
    readonly owner: string;
    readonly manifestPath: string;
    readonly manifestSha256: string;
  };
  readonly map: {
    readonly center: readonly [number, number];
    readonly zoom: number;
    readonly assets: {
      readonly context: string;
      readonly terrain: string;
      readonly contours: string;
      readonly change: string;
      readonly ndvi: string;
      readonly ndmi: string;
      readonly effis: string;
      readonly download: string;
    };
  };
  readonly activeFire: {
    readonly currentPath: string;
    readonly statusPath: string;
  };
  readonly dates: readonly ExplorerDate[];
  readonly groups: readonly {
    readonly id: string;
    readonly name: { readonly en: string; readonly cy: string };
    readonly description: { readonly en: string; readonly cy: string };
  }[];
  readonly layers: readonly ExplorerLayer[];
  readonly claim: string;
  readonly incident: {
    readonly firstReport: string;
    readonly chronology: string;
    readonly unknowns: string;
  };
  readonly evidenceStates: readonly {
    readonly id: string;
    readonly meaning: string;
    readonly pixels: number;
    readonly areaHaRounded: number;
  }[];
  readonly contextCounts: readonly { readonly label: string; readonly count: number }[];
  readonly terrain: {
    readonly minimumM: number;
    readonly maximumM: number;
    readonly meanM: number;
    readonly contourIntervalM: number;
  };
  readonly limitations: readonly string[];
}

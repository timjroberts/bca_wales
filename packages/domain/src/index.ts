export const PRODUCT_SCOPE =
  "A public, read-only view of a deliberately small selection of open Blorenge landscape datasets, with their sources and limitations kept in view.";

export type Language = "en" | "cy";

export type EvidenceClassification =
  | "authoritative"
  | "provisional"
  | "derived"
  | "contextual"
  | "historical";

export interface ExplorerSelection {
  readonly language: Language;
  readonly visibleLayerIds: readonly string[];
  readonly primaryDate: string | null;
  readonly comparisonDate: string | null;
}

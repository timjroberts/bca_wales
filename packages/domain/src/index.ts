export const PRODUCT_SCOPE =
  "A public, read-only view of a deliberately small selection of open Blorenge landscape datasets, with their sources and limitations kept in view.";

export type Language = "en" | "cy";

export type ContrastLevel = "low" | "medium" | "high";

export interface LocalisedText {
  readonly en: string;
  readonly cy?: string;
}

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

export interface ExplorerState extends ExplorerSelection {
  readonly comparisonEnabled: boolean;
  readonly contrast: ContrastLevel;
}

export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  language: "en",
  visibleLayerIds: [],
  primaryDate: null,
  comparisonDate: null,
  comparisonEnabled: false,
  contrast: "medium"
};

export function toggleVisibleLayer(state: ExplorerState, layerId: string): ExplorerState {
  const visibleLayerIds = state.visibleLayerIds.includes(layerId)
    ? state.visibleLayerIds.filter((id) => id !== layerId)
    : [...state.visibleLayerIds, layerId];

  return { ...state, visibleLayerIds };
}

export function localise(text: LocalisedText, language: Language): string {
  return language === "cy" && text.cy ? text.cy : text.en;
}

import type { ExplorerSelection } from "@bca/domain";

export interface MapViewport {
  readonly longitude: number;
  readonly latitude: number;
  readonly zoom: number;
}

export interface MapAdapter {
  mount(container: HTMLElement): void;
  applySelection(selection: ExplorerSelection): void;
  setViewport(viewport: MapViewport): void;
  destroy(): void;
}

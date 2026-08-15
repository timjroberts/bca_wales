export const MAP_APPLICATION_MIN_WIDTH = 761;
export const MAP_APPLICATION_MIN_HEIGHT = 560;

export type MapApplicationState = Readonly<{
  pinned: boolean;
  dismissed: boolean;
}>;

export type MapApplicationMeasurement = Readonly<{
  viewportWidth: number;
  viewportHeight: number;
  sentinelTop: number;
}>;

export const INITIAL_MAP_APPLICATION_STATE: MapApplicationState = {
  pinned: false,
  dismissed: false
};

export function canPinMap({
  viewportWidth,
  viewportHeight
}: Pick<MapApplicationMeasurement, "viewportWidth" | "viewportHeight">): boolean {
  return viewportWidth >= MAP_APPLICATION_MIN_WIDTH && viewportHeight >= MAP_APPLICATION_MIN_HEIGHT;
}

export function updateMapApplicationState(
  current: MapApplicationState,
  measurement: MapApplicationMeasurement
): MapApplicationState {
  if (!canPinMap(measurement)) {
    return {
      pinned: false,
      dismissed: current.dismissed || current.pinned
    };
  }

  if (measurement.sentinelTop > 0) {
    return INITIAL_MAP_APPLICATION_STATE;
  }

  if (current.dismissed) {
    return { pinned: false, dismissed: true };
  }

  return { pinned: true, dismissed: false };
}

export function dismissMapApplicationMode(): MapApplicationState {
  return { pinned: false, dismissed: true };
}

export type MapApplicationExit = "top" | "footer";

export function mapApplicationExitPlan(
  destination: MapApplicationExit,
  reducedMotion: boolean
): Readonly<{
  focusId: "page-top" | "service-footer";
  behavior: ScrollBehavior;
}> {
  return {
    focusId: destination === "top" ? "page-top" : "service-footer",
    behavior: reducedMotion ? "auto" : "smooth"
  };
}

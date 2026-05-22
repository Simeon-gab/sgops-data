import { africaData } from "./africa";
import { americasData } from "./americas";
import { europeData } from "./europe";
import { asiaPacificData } from "./asia-pacific";

export type LocationDatabase = {
  [countryCode: string]: {
    states: {
      [stateName: string]: string[];
    };
  };
};

export const LOCATION_DATA: LocationDatabase = {
  ...africaData,
  ...americasData,
  ...europeData,
  ...asiaPacificData,
};

export function getStatesForCountry(countryCode: string): string[] {
  return Object.keys(LOCATION_DATA[countryCode]?.states ?? {});
}

export function getCitiesForState(countryCode: string, stateName: string): string[] {
  return LOCATION_DATA[countryCode]?.states[stateName] ?? [];
}

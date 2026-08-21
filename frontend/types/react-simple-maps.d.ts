declare module "react-simple-maps" {
  import { ComponentType, CSSProperties, ReactNode } from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  interface GeographiesChildrenArgs {
    geographies: GeographyType[];
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: GeographiesChildrenArgs) => ReactNode;
  }

  interface GeographyType {
    rsmKey: string;
    properties: Record<string, unknown>;
    type: string;
    geometry: unknown;
  }

  interface GeographyStyleConfig {
    outline?: string;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    cursor?: string;
    transition?: string;
  }

  interface GeographyProps {
    geography: GeographyType;
    key?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: GeographyStyleConfig;
      hover?: GeographyStyleConfig;
      pressed?: GeographyStyleConfig;
    };
    className?: string;
    onMouseEnter?: (event: unknown) => void;
    onMouseMove?: (event: unknown) => void;
    onMouseLeave?: (event: unknown) => void;
    onClick?: (event: unknown) => void;
    onFocus?: (event: unknown) => void;
    onBlur?: (event: unknown) => void;
    tabIndex?: number;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const ZoomableGroup: ComponentType<{
    center?: [number, number];
    zoom?: number;
    children?: ReactNode;
  }>;
  export const Marker: ComponentType<{
    coordinates?: [number, number];
    children?: ReactNode;
  }>;
  export const Line: ComponentType<{
    from?: [number, number];
    to?: [number, number];
  }>;
  export const Graticule: ComponentType<Record<string, unknown>>;
  export const Sphere: ComponentType<Record<string, unknown>>;
}

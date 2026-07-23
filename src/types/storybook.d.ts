/**
 * Type declarations for @storybook/react — enables tsc to pass
 * without the package being installed. The actual types are resolved
 * once `npm install -D @storybook/react @storybook/react-vite` is run.
 */
declare module '@storybook/react' {
  import type { ComponentType, ReactElement } from 'react';

  export interface Meta<T = any> {
    title?: string;
    component?: ComponentType<any>;
    tags?: string[];
    argTypes?: Record<string, unknown>;
    args?: Partial<T>;
    decorators?: Array<(Story: ComponentType, context: unknown) => ReactElement>;
    parameters?: Record<string, unknown>;
    render?: (args: any, context?: unknown) => ReactElement | null;
  }

  export interface StoryObj<T = any> {
    args?: Partial<T>;
    argTypes?: Record<string, unknown>;
    name?: string;
    decorators?: Array<(Story: ComponentType, context: unknown) => ReactElement>;
    parameters?: Record<string, unknown>;
    render?: (args: any, context?: unknown) => ReactElement | null;
    play?: (context: { canvasElement: HTMLElement; step: (label: string, fn: () => Promise<void>) => Promise<void> }) => Promise<void>;
  }

  export interface Preview {
    parameters?: Record<string, unknown>;
    decorators?: Array<(Story: ComponentType, context: unknown) => ReactElement>;
    globalTypes?: Record<string, unknown>;
    tags?: string[];
  }
}

declare module '@storybook/react-vite' {
  import type { StorybookConfig as BaseConfig } from '@storybook/react';
  export type StorybookConfig = BaseConfig & {
    viteFinal?: (config: any) => Promise<any>;
  };
}

declare module '@storybook/addon-links' {}

declare module '@storybook/addon-a11y' {}

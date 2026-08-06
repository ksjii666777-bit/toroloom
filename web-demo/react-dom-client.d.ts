/**
 * Minimal type shim for `react-dom/client` in the web-demo harness.
 *
 * `@types/react-dom` is not installed (the native app never imports it), so
 * without this the repo-wide `npm run typecheck` fails on web-demo/main.tsx.
 * The harness only uses `createRoot`, so an `any`-typed surface is sufficient.
 */
declare module 'react-dom/client' {
  const createRoot: (container: Element | DocumentFragment) => {
    render: (node: unknown) => void;
    unmount: () => void;
  };
  export { createRoot };
}

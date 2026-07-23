/**
 * Mock for react-native-web/Libraries/Utilities/codegenNativeComponent.
 * react-native-safe-area-context imports this internally.
 * In the browser (Storybook), we return a simple View proxy.
 */
export default function codegenNativeComponent(componentName: string) {
  return componentName;
}

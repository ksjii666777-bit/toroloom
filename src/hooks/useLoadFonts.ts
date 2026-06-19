import {
  useFonts,
  Inter_100Thin,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

const FONT_CONFIG = {
  'Inter-Thin': Inter_100Thin,
  'Inter-Light': Inter_300Light,
  'Inter-Regular': Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
  'Inter-ExtraBold': Inter_800ExtraBold,
  'Inter-Black': Inter_900Black,
};

export default function useLoadFonts(): { fontsLoaded: boolean; fontError: Error | null } {
  const [loaded, error] = useFonts(FONT_CONFIG);
  return { fontsLoaded: loaded, fontError: error };
}

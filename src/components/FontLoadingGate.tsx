import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import useLoadFonts from '../hooks/useLoadFonts';

interface FontLoadingGateProps {
  children: React.ReactNode;
}

function FontLoadingGate({ children }: FontLoadingGateProps) {
  const { fontsLoaded, fontError } = useLoadFonts();

  if (fontError) {
    // Font failed to load — app still works with system fallback
    return <>{children}</>;
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <>{children}</>;
}

export default FontLoadingGate;

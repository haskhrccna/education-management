import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import i18n from '@/src/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => { i18n.init(); }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="first-login" />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="student/home" />
        <Stack.Screen name="teacher/home" />
        <Stack.Screen name="admin/home" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

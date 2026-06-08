import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op stub (`static alert() {}`) — it
// silently swallows every call, so error/info dialogs never appear on web.
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

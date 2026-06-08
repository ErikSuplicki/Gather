import { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function DiscoverScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Entdecken</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Spieler suchen..."
          placeholderTextColor={C.textDim}
        />
      </View>

      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🧭</Text>
        <Text style={styles.emptyTitle}>Spieler in deiner Nähe</Text>
        <Text style={styles.emptyText}>
          Hier erscheinen bald TCG-Spieler in deiner Nähe.{'\n'}Schau regelmäßig vorbei!
        </Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 16,
    },
    title: {
      color: C.text,
      fontSize: 36,
      fontFamily: FONTS.extrabold,
      letterSpacing: -0.5,
    },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface2,
      borderRadius: 14,
      marginHorizontal: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      marginBottom: 24,
    },
    searchIcon: { fontSize: 16, opacity: 0.5 },
    searchInput: {
      flex: 1,
      color: C.text,
      fontFamily: FONTS.regular,
      fontSize: 15,
    },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 12,
      marginBottom: 60,
    },
    emptyEmoji: { fontSize: 48, marginBottom: 4 },
    emptyTitle: {
      color: C.text,
      fontSize: 18,
      fontFamily: FONTS.bold,
      textAlign: 'center',
    },
    emptyText: {
      color: C.textMuted,
      fontSize: 14,
      fontFamily: FONTS.regular,
      textAlign: 'center',
      lineHeight: 21,
    },
  });
}

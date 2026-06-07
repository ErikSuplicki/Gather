import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DiscoverScreen() {
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
          placeholderTextColor="#555555"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});

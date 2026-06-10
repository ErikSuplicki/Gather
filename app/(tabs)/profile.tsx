import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { TCG_MAP, TCG_FIELDS, MTG_COLORS, PLAY_STYLES } from '@/constants/tcgs';
import { FONTS, ThemeColors, ELEVATION, RADII } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { ManaSymbol } from '@/components/icons';
import { DeckImportModal } from '@/components/DeckImportModal';
import { DeckBrowserModal } from '@/components/DeckBrowserModal';
import { DeckTile } from '@/components/DeckTile';
import { TCGIcon } from '@/components/TCGIcon';
import { supabase } from '@/lib/supabase';
import { uploadAvatar, signOut } from '@/lib/auth';
import { Profile, UserTCG, TCGId, UserDeck } from '@/types';

const PLACEHOLDER_BIO = 'Sammle seit Jahren Karten, liebe enge Matches und ziehe nach jedem Turnier ein neues Deck aus dem Hut. Immer offen für eine Partie.';
const PLAYER_LEVEL = 24;
const PLAYER_XP    = 2350;
const PLAYER_XP_NEXT = 3000;

const ENGAGEMENT_STATS = [
  { value: '72',  label: 'Events' },
  { value: '143', label: 'Gegner' },
  { value: '28',  label: 'Turniere' },
  { value: '4.8', label: 'Bewertung' },
];

const PLACEHOLDER_ACTIVITY = {
  lead: 'Nimmt teil an',
  highlight: 'Commander Night',
  meta: 'Heute, 19:00',
};

export default function ProfileScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [tcgs, setTcgs]             = useState<UserTCG[]>([]);
  const [tcgDetails, setTcgDetails] = useState<Record<string, string>>({});
  const [activeTCG, setActiveTCG]   = useState<TCGId | null>(null);
  const [editing, setEditing]       = useState(false);
  const [editDetails, setEditDetails] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editSkill, setEditSkill]   = useState(0);
  const [userId, setUserId]         = useState<string | null>(null);
  const [decks, setDecks]           = useState<UserDeck[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserInitialDeckId, setBrowserInitialDeckId] = useState<string | null>(null);

  const openDeckBrowser = (deckId: string | null = null) => {
    setBrowserInitialDeckId(deckId);
    setBrowserOpen(true);
  };

  const openDeckImportFromBrowser = () => { setBrowserOpen(false); setImportOpen(true); };
  const handleImportedDeck  = (deck: UserDeck) => setDecks(prev => [deck, ...prev]);
  const handleDeckUpdated   = (deck: UserDeck) => setDecks(prev => prev.map(d => d.id === deck.id ? deck : d));
  const deleteDeck = async (deck: UserDeck) => {
    setDecks(prev => prev.filter(d => d.id !== deck.id));
    await supabase.from('user_decks').delete().eq('id', deck.id);
  };

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    setUserId(uid);
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('user_tcgs').select('*').eq('user_id', uid).order('tcg'),
    ]);
    setProfile(p);
    const list = (t ?? []) as UserTCG[];
    setTcgs(list);
    setActiveTCG(prev => prev ?? (list[0]?.tcg as TCGId ?? null));
  }, []);

  useEffect(() => { fetchProfile().finally(() => setLoading(false)); }, [fetchProfile]);

  const fetchTCGDetails = useCallback(async (tcg: TCGId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('user_tcg_details').select('*')
      .eq('user_id', session.user.id).eq('tcg', tcg).single();
    const d = (data?.details as Record<string, string>) ?? {};
    setTcgDetails(d);
    setEditDetails(d);
  }, []);

  const fetchDecks = useCallback(async (tcg: TCGId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('user_decks').select('*')
      .eq('user_id', session.user.id).eq('tcg', tcg)
      .order('created_at', { ascending: false });
    setDecks((data ?? []) as UserDeck[]);
  }, []);

  useEffect(() => {
    if (!activeTCG) return;
    fetchTCGDetails(activeTCG);
    fetchDecks(activeTCG);
  }, [activeTCG, fetchTCGDetails, fetchDecks]);

  const saveDetails = async () => {
    if (!activeTCG) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('user_tcg_details').upsert(
        { user_id: session.user.id, tcg: activeTCG, details: editDetails },
        { onConflict: 'user_id,tcg' },
      );
      if (error) throw error;
      await supabase.from('user_tcgs')
        .update({ skill_level: editSkill })
        .eq('user_id', session.user.id).eq('tcg', activeTCG);
      setTcgs(prev => prev.map(t => t.tcg === activeTCG ? { ...t, skill_level: editSkill } : t));
      setTcgDetails(editDetails);
      setEditing(false);
    } catch (e) { console.error('saveDetails failed:', e); }
    finally { setSaving(false); }
  };

  const changeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = await uploadAvatar(result.assets[0].base64, session.user.id);
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    } catch { /* silent */ }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile()
      .then(() => { if (activeTCG) return Promise.all([fetchTCGDetails(activeTCG), fetchDecks(activeTCG)]); })
      .finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const activeTCGInfo = activeTCG ? TCG_MAP[activeTCG] : null;
  const activeTCGSkill = tcgs.find(t => t.tcg === activeTCG)?.skill_level ?? 0;
  const fields = activeTCG ? TCG_FIELDS[activeTCG] : [];
  const avgSkill = tcgs.length
    ? Math.round(tcgs.reduce((s, t) => s + t.skill_level, 0) / tcgs.length)
    : 0;
  const handle = (profile?.username ?? 'spieler').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : '—';
  const xpPct = Math.min(100, Math.round((PLAYER_XP / PLAYER_XP_NEXT) * 100));
  const tcgStartStats = [
    { value: '61%',  label: 'Winrate' },
    { value: String(decks.length), label: 'Decks' },
    { value: '312h', label: 'Spielzeit' },
    { value: '3',    label: 'Top 8' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── DS TopBar ── */}
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Profil</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              onPress={() => {}}
            >
              <Text style={styles.iconBtnLabel}>↗</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              onPress={() => {}}
            >
              <Text style={styles.iconBtnLabel}>⋯</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && styles.iconBtnDangerPressed]}
              onPress={() => signOut()}
            >
              <Text style={[styles.iconBtnLabel, styles.iconBtnDangerLabel]}>↪</Text>
            </Pressable>
          </View>
        </View>

        {/* ── DS ProfileCard — identity block ── */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <Pressable onPress={changeAvatar} style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(profile?.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
            <View style={styles.cameraTag}>
              <Text style={styles.cameraTagText}>+</Text>
            </View>
          </Pressable>

          {/* Name + handle */}
          <View style={styles.nameRow}>
            <Text style={styles.username}>{profile?.username ?? '—'}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✦</Text>
            </View>
          </View>
          <Text style={styles.handle}>@{handle}</Text>
          <Text style={styles.bio}>{PLACEHOLDER_BIO}</Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            {!!profile?.region && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>{profile.region}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>Seit {memberSince}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionPrimary, pressed && styles.actionPrimaryPressed]}
              onPress={() => {}}
            >
              <Text style={styles.actionPrimaryText}>Profil bearbeiten</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionSettings, pressed && styles.actionSettingsPressed]}
              onPress={() => {}}
            >
              <Text style={styles.actionSettingsIcon}>⚙</Text>
            </Pressable>
          </View>
        </View>

        {/* ── DS ProfileCard — stat strip ── */}
        <View style={styles.statStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{tcgs.length}</Text>
            <Text style={styles.statLabel}>TCGs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{avgSkill > 0 ? avgSkill : '—'}</Text>
            <Text style={styles.statLabel}>Ø Skill</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <View style={styles.tcgEmojis}>
              {tcgs.slice(0, 4).map(t => (
                <TCGIcon key={t.tcg} tcg={TCG_MAP[t.tcg as TCGId]} size={14} color={C.textMuted} />
              ))}
            </View>
            <Text style={styles.statLabel}>Spiele</Text>
          </View>
        </View>

        {/* ── TCG selector chips ── */}
        {tcgs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tcgPillsRow}
            style={styles.tcgPillsWrap}
          >
            {tcgs.map(t => {
              const info = TCG_MAP[t.tcg as TCGId];
              const isActive = t.tcg === activeTCG;
              return (
                <Pressable
                  key={t.tcg}
                  onPress={() => { setActiveTCG(t.tcg as TCGId); setEditing(false); }}
                  style={({ pressed }) => [
                    styles.tcgPill,
                    isActive && styles.tcgPillActive,
                    pressed && !isActive && styles.tcgPillPressed,
                  ]}
                >
                  <TCGIcon tcg={info} size={16} color={isActive ? C.primaryBright : C.textMuted} />
                  <Text style={[styles.tcgPillText, isActive && styles.tcgPillTextActive]} numberOfLines={1}>
                    {info.name.split(':')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ── Spielerlevel card (DS Card + ProgressBar + StatCard grid) ── */}
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardHeader}>
            <Text style={styles.sectionLabel}>SPIELERLEVEL</Text>
            <View style={styles.levelBadge}>
              <View style={styles.levelBadgeDiamond} />
              <Text style={styles.levelBadgeGlyph}>★</Text>
            </View>
          </View>

          {/* Level + XP */}
          <View style={styles.levelValueRow}>
            <Text style={styles.levelValue}>Lv. {PLAYER_LEVEL}</Text>
            <Text style={styles.levelXpText}>
              {PLAYER_XP.toLocaleString('de-DE')} / {PLAYER_XP_NEXT.toLocaleString('de-DE')} XP
            </Text>
          </View>

          {/* DS ProgressBar (brand) */}
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpPct}%` as any }]} />
          </View>

          {/* DS StatCard grid */}
          <View style={styles.engagementRow}>
            {ENGAGEMENT_STATS.map(s => (
              <View key={s.label} style={styles.engagementCell}>
                <Text style={styles.engagementValue}>{s.value}</Text>
                <Text style={styles.engagementLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TCG-specific content ── */}
        {activeTCG && activeTCGInfo && (
          <View style={styles.tcgContent}>

            {/* Since-beginn card */}
            <View style={[styles.card, { borderColor: activeTCGInfo.color + '33' }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Seit Beginn bei {activeTCGInfo.name.split(':')[0]}
                </Text>
              </View>
              <View style={styles.engagementRow}>
                {tcgStartStats.map(s => (
                  <View key={s.label} style={styles.engagementCell}>
                    <Text style={styles.engagementValue}>{s.value}</Text>
                    <Text style={styles.engagementLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Skill bar */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SKILLSTUFE</Text>
              <View style={styles.skillBar}>
                {Array.from({ length: 10 }, (_, i) => {
                  const displaySkill = editing ? editSkill : activeTCGSkill;
                  const filled = i < displaySkill;
                  if (editing) {
                    return (
                      <Pressable
                        key={i}
                        style={[styles.skillSeg, styles.skillSegEditable, filled && styles.skillSegFilled]}
                        onPress={() => setEditSkill(i + 1)}
                        hitSlop={{ top: 14, bottom: 14 }}
                      />
                    );
                  }
                  return <View key={i} style={[styles.skillSeg, filled && styles.skillSegFilled]} />;
                })}
                <Text style={styles.skillNum}>{editing ? editSkill : activeTCGSkill}/10</Text>
              </View>

              {/* Edit actions */}
              <View style={styles.sectionActions}>
                {editing ? (
                  <>
                    <Pressable onPress={() => { setEditDetails(tcgDetails); setEditSkill(activeTCGSkill); setEditing(false); }}>
                      <Text style={styles.cancelText}>Abbrechen</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveDetails}
                      disabled={saving}
                      style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
                    >
                      {saving
                        ? <ActivityIndicator color="#FFFFFF" size="small" />
                        : <Text style={styles.saveBtnText}>Speichern</Text>
                      }
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                    onPress={() => { setEditDetails(tcgDetails); setEditSkill(activeTCGSkill); setEditing(true); }}
                  >
                    <Text style={styles.editBtnText}>Bearbeiten</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Decks */}
            <View style={styles.deckSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>DECKS ({decks.length})</Text>
                <Pressable onPress={() => setImportOpen(true)}>
                  <Text style={styles.linkText}>+ Deck importieren</Text>
                </Pressable>
              </View>

              {decks.length > 0 ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
                    {decks.map(deck => (
                      <DeckTile
                        key={deck.id}
                        deck={deck}
                        tcgInfo={activeTCGInfo}
                        onPress={() => openDeckBrowser(deck.id)}
                        editing={editing}
                        onDelete={() => deleteDeck(deck)}
                      />
                    ))}
                  </ScrollView>
                  <Pressable
                    style={({ pressed }) => [styles.viewAllBtn, pressed && styles.viewAllBtnPressed]}
                    onPress={() => openDeckBrowser(null)}
                  >
                    <Text style={styles.viewAllBtnText}>Alle {decks.length} Decks anzeigen ›</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>Noch keine Decks importiert</Text>
                  <Pressable
                    style={({ pressed }) => [styles.importDeckBtn, pressed && styles.importDeckBtnPressed]}
                    onPress={() => setImportOpen(true)}
                  >
                    <Text style={styles.importDeckBtnText}>+ Deck importieren</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* TCG field blocks */}
            {fields.map(field => {
              const displayVal = (editing ? editDetails : tcgDetails)[field.key] ?? '';
              return (
                <View key={field.key} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>

                  {field.type === 'manaColor' ? (
                    <View style={styles.manaRow}>
                      {MTG_COLORS.map(c => {
                        const isSel = displayVal === c.id;
                        return (
                          <Pressable
                            key={c.id}
                            style={[styles.manaBtn, isSel && styles.manaBtnActive, !isSel && { opacity: editing ? 0.65 : 0.35 }]}
                            onPress={() => editing && setEditDetails(p => ({ ...p, [field.key]: c.id }))}
                            disabled={!editing}
                          >
                            <ManaSymbol manaId={c.id} size={40} />
                            <Text style={styles.manaLabel}>{c.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : field.type === 'playStyle' ? (
                    <View style={styles.styleRow}>
                      {PLAY_STYLES.map(s => {
                        const isSel = displayVal === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            style={[styles.styleBtn, isSel && styles.styleBtnActive, !isSel && { opacity: editing ? 0.65 : 0.4 }]}
                            onPress={() => editing && setEditDetails(p => ({ ...p, [field.key]: s.id }))}
                            disabled={!editing}
                          >
                            <Text style={[styles.styleBtnText, isSel && styles.styleBtnTextActive]}>
                              {s.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : editing ? (
                    <TextInput
                      style={[styles.fieldInput, field.type === 'multiline' && styles.multilineInput]}
                      value={editDetails[field.key] ?? ''}
                      onChangeText={v => setEditDetails(p => ({ ...p, [field.key]: v }))}
                      placeholderTextColor={C.textFaint}
                      placeholder={`${field.label} eingeben...`}
                      multiline={field.type === 'multiline'}
                      numberOfLines={field.type === 'multiline' ? 4 : 1}
                    />
                  ) : (
                    <Text style={displayVal ? styles.fieldValue : styles.fieldEmpty}>
                      {displayVal || '—'}
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Letzte Aktivitäten */}
            <View style={styles.deckSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>LETZTE AKTIVITÄTEN</Text>
                <Pressable onPress={() => {}}>
                  <Text style={styles.linkText}>Alle anzeigen</Text>
                </Pressable>
              </View>
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Text style={{ fontSize: 18 }}>🎲</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {PLACEHOLDER_ACTIVITY.lead}{' '}
                    <Text style={styles.activityHighlight}>{PLACEHOLDER_ACTIVITY.highlight}</Text>
                  </Text>
                  <Text style={styles.activityMeta}>{PLACEHOLDER_ACTIVITY.meta}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {tcgs.length === 0 && !loading && (
          <View style={[styles.center, { padding: 40 }]}>
            <Text style={styles.emptyText}>Keine TCGs im Profil.</Text>
          </View>
        )}
      </ScrollView>

      {activeTCG && (
        <DeckImportModal
          visible={importOpen}
          onClose={() => setImportOpen(false)}
          tcg={activeTCG}
          userId={userId ?? ''}
          onImported={handleImportedDeck}
        />
      )}
      {activeTCGInfo && (
        <DeckBrowserModal
          visible={browserOpen}
          onClose={() => setBrowserOpen(false)}
          decks={decks}
          tcgInfo={activeTCGInfo}
          initialDeckId={browserInitialDeckId}
          editing={editing}
          onDeckUpdated={handleDeckUpdated}
          onImportDeck={openDeckImportFromBrowser}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 100 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:     { color: C.textFaint, fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center' },

  // DS TopBar
  topBar: {
    height:            56,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
  },
  pageTitle: {
    color:         C.text,
    fontSize:      22,
    fontFamily:    FONTS.bold,
    letterSpacing: -0.22,
  },
  headerActions: { flexDirection: 'row', gap: 8 },

  // DS IconButton
  iconBtn: {
    width:           36,
    height:          36,
    backgroundColor: C.surface2,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconBtnPressed: { backgroundColor: C.surface3 },
  iconBtnLabel:   { color: C.textMuted, fontSize: 16 },
  iconBtnDanger:  { backgroundColor: C.errorBg, borderColor: C.errorRing },
  iconBtnDangerPressed: { backgroundColor: 'rgba(227,98,89,0.22)' },
  iconBtnDangerLabel:   { color: C.error },

  // DS ProfileCard identity block
  profileCard: {
    marginHorizontal: 16,
    marginBottom:     12,
    alignItems:       'center',
    backgroundColor:  C.surface,
    borderWidth:      1,
    borderColor:      C.border,
    borderRadius:     16,
    padding:          16,
    ...ELEVATION.panel,
  },
  avatarWrap:   { position: 'relative', marginBottom: 12 },
  avatar:       { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.border },
  avatarFallback: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: C.surface2,
    borderWidth:     2,
    borderColor:     C.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: { fontSize: 32, fontFamily: FONTS.bold, color: C.primary },
  onlineDot: {
    position:        'absolute',
    bottom:          4,
    left:            2,
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: C.success,
    borderWidth:     2,
    borderColor:     C.surface,
  },
  cameraTag: {
    position:        'absolute',
    bottom:          2,
    right:           2,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: C.surface3,
    borderWidth:     1.5,
    borderColor:     C.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cameraTagText: { color: C.text, fontSize: 13, fontFamily: FONTS.bold, lineHeight: 15 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  username:     { color: C.text, fontSize: 18, fontFamily: FONTS.bold },
  verifiedBadge: {
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: C.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  verifiedBadgeText: { color: '#FFFFFF', fontSize: 9, fontFamily: FONTS.bold },
  handle:  { color: C.textFaint, fontSize: 12, fontFamily: FONTS.regular, marginBottom: 10 },
  bio: {
    color:             C.textMuted,
    fontSize:          13,
    fontFamily:        FONTS.regular,
    lineHeight:        18,
    textAlign:         'center',
    paddingHorizontal: 8,
    marginBottom:      12,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 12 },
  metaText: { color: C.textMuted, fontSize: 12, fontFamily: FONTS.medium },

  // Action buttons
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  actionPrimary: {
    flex:            1,
    height:          40,
    backgroundColor: C.primary,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     C.primary,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
  },
  actionPrimaryPressed: { backgroundColor: C.primaryDeep },
  actionPrimaryText:    { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semibold },
  actionSettings: {
    width:           40,
    height:          40,
    backgroundColor: C.surface2,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionSettingsPressed: { backgroundColor: C.surface3 },
  actionSettingsIcon:    { color: C.textMuted, fontSize: 18 },

  // DS ProfileCard stat strip
  statStrip: {
    flexDirection:    'row',
    marginHorizontal: 16,
    marginBottom:     12,
    backgroundColor:  C.surface,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      C.border,
    ...ELEVATION.panel,
  },
  statCell:  { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  statValue: {
    color:      C.text,
    fontSize:   18,
    fontFamily: FONTS.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color:         C.textFaint,
    fontSize:      10,
    fontFamily:    FONTS.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider:    { width: 1, backgroundColor: C.border, marginVertical: 10 },
  tcgEmojis:      { flexDirection: 'row', gap: 4 },
  tcgEmoji:       { fontSize: 9, fontFamily: FONTS.bold, color: C.textMuted, letterSpacing: 0.3 },

  // TCG chips (DS Chip component)
  tcgPillsWrap: { marginBottom: 12 },
  tcgPillsRow:  { paddingHorizontal: 16, gap: 8 },
  tcgPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    height:            32,
    paddingHorizontal: 12,
    borderRadius:      RADII.pill,
    borderWidth:       1,
    backgroundColor:   C.surface2,
    borderColor:       C.borderDefault,
  },
  tcgPillActive:     { backgroundColor: C.primaryTintMed, borderColor: 'rgba(22,139,255,0.40)' },
  tcgPillPressed:    { backgroundColor: C.surface3 },
  tcgPillEmoji:      { fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 0.3 },
  tcgPillText:       { color: C.textMuted, fontSize: 12, fontFamily: FONTS.semibold },
  tcgPillTextActive: { color: C.primaryBright },

  // DS Card
  card: {
    backgroundColor:  C.surface,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      C.border,
    padding:          14,
    marginHorizontal: 16,
    marginBottom:     12,
    gap:              10,
    ...ELEVATION.panel,
  },
  cardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  cardTitle:    { color: C.text, fontSize: 13, fontFamily: FONTS.semibold },
  sectionLabel: {
    color:         C.textFaint,
    fontSize:      10,
    fontFamily:    FONTS.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Level badge (diamond shape)
  levelBadge:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  levelBadgeDiamond: {
    position:        'absolute',
    width:           22,
    height:          22,
    borderRadius:    5,
    borderWidth:     1.5,
    borderColor:     C.primary,
    backgroundColor: C.primaryTint,
    transform:       [{ rotate: '45deg' }],
  },
  levelBadgeGlyph: { color: C.primary, fontSize: 13 },

  levelValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  levelValue:    { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22 },
  levelXpText:   { color: C.textMuted, fontSize: 12, fontFamily: FONTS.medium },

  // DS ProgressBar (brand)
  xpTrack: { height: 5, borderRadius: RADII.pill, backgroundColor: C.surface3, overflow: 'hidden' },
  xpFill:  {
    height:          5,
    borderRadius:    RADII.pill,
    backgroundColor: C.primary,
    shadowColor:     C.primary,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.35,
    shadowRadius:    4,
  },

  // DS StatCard grid (engagement)
  engagementRow: { flexDirection: 'row', gap: 8 },
  engagementCell: {
    flex:              1,
    backgroundColor:   C.surface2,
    borderRadius:      RADII.sm,
    paddingVertical:   8,
    paddingHorizontal: 8,
    alignItems:        'center',
    gap:               3,
  },
  engagementValue: {
    color:      C.text,
    fontSize:   16,
    fontFamily: FONTS.bold,
    fontVariant: ['tabular-nums'],
  },
  engagementLabel: { color: C.textFaint, fontSize: 10, fontFamily: FONTS.medium, textAlign: 'center' },

  // Skill bar (DS ProgressBar variant)
  skillBar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  skillSeg: { flex: 1, height: 4, borderRadius: RADII.pill, backgroundColor: C.surface3 },
  skillSegEditable: { height: 8, borderRadius: 4 },
  skillSegFilled:   { backgroundColor: C.primary },
  skillNum: { color: C.textFaint, fontSize: 12, fontFamily: FONTS.medium, marginLeft: 4, width: 28 },

  // Section header
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   10,
  },
  linkText: { color: C.primary, fontSize: 12, fontFamily: FONTS.semibold },

  // Edit actions
  sectionActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  editBtn: {
    borderWidth:       1,
    borderColor:       C.borderDefault,
    borderRadius:      10,
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  editBtnPressed: { backgroundColor: C.surface2 },
  editBtnText:    { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
  cancelText:     { color: C.textFaint, fontSize: 13, fontFamily: FONTS.regular },
  saveBtn: {
    backgroundColor:   C.primary,
    borderRadius:      10,
    paddingHorizontal: 20,
    paddingVertical:   8,
    minWidth:          90,
    alignItems:        'center',
  },
  saveBtnPressed: { backgroundColor: C.primaryDeep },
  saveBtnText:    { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semibold },

  // Decks section
  deckSection:   { marginHorizontal: 16, marginBottom: 12 },
  deckRow:       { gap: 12, paddingRight: 4 },
  viewAllBtn: {
    alignSelf:         'center',
    marginTop:         12,
    paddingVertical:   9,
    paddingHorizontal: 16,
    borderRadius:      10,
    backgroundColor:   C.surface2,
    borderWidth:       1,
    borderColor:       C.border,
  },
  viewAllBtnPressed: { backgroundColor: C.surface3 },
  viewAllBtnText:    { color: C.text, fontSize: 13, fontFamily: FONTS.semibold },
  importDeckBtn: {
    borderWidth:       1,
    borderColor:       C.primary,
    borderRadius:      10,
    paddingVertical:   10,
    paddingHorizontal: 16,
    alignSelf:         'flex-start',
    marginTop:         8,
  },
  importDeckBtnPressed: { backgroundColor: C.primaryTint },
  importDeckBtnText:    { color: C.primary, fontSize: 13, fontFamily: FONTS.semibold },

  // Fields
  tcgContent: { paddingTop: 4 },
  fieldBlock:  { marginHorizontal: 16, marginBottom: 20 },
  fieldLabel: {
    color:         C.textFaint,
    fontSize:      10,
    fontFamily:    FONTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  8,
  },
  fieldValue: { color: C.text, fontSize: 14, fontFamily: FONTS.regular },
  fieldEmpty: { color: C.textDisabled, fontSize: 14, fontFamily: FONTS.regular },
  fieldInput: {
    backgroundColor:   C.surface2,
    borderWidth:       1,
    borderColor:       C.border,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   10,
    color:             C.text,
    fontSize:          14,
    fontFamily:        FONTS.regular,
  },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },

  // Mana colors
  manaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  manaBtn: {
    alignItems:    'center',
    gap:           4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius:  10,
    borderWidth:   1.5,
    borderColor:   'transparent',
    minWidth:      52,
  },
  manaBtnActive: { borderColor: C.primary, backgroundColor: C.primaryTint },
  manaLabel:     { color: C.textFaint, fontSize: 10, fontFamily: FONTS.medium },

  // Play style
  styleRow: { flexDirection: 'row', gap: 8 },
  styleBtn: {
    flex:          1,
    backgroundColor: C.surface2,
    borderWidth:   1,
    borderColor:   C.borderDefault,
    borderRadius:  10,
    paddingVertical: 10,
    alignItems:    'center',
  },
  styleBtnActive:     { backgroundColor: C.primary, borderColor: C.primary },
  styleBtnText:       { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
  styleBtnTextActive: { color: '#FFFFFF' },

  // Activity
  activityRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    backgroundColor:  C.surface2,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      C.border,
    padding:          12,
  },
  activityIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    8,
    backgroundColor: C.primaryTint,
    alignItems:      'center',
    justifyContent:  'center',
  },
  activityTitle:     { color: C.text, fontSize: 13, fontFamily: FONTS.medium },
  activityHighlight: { color: C.primary, fontFamily: FONTS.semibold },
  activityMeta:      { color: C.textFaint, fontSize: 11, marginTop: 2 },
  });
}

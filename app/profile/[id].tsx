import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

import { TCG_MAP, TCG_FIELDS, MTG_COLORS, PLAY_STYLES } from '@/constants/tcgs';
import { FONTS, ThemeColors, ELEVATION } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { ManaSymbol } from '@/components/icons';
import { DeckBrowserModal } from '@/components/DeckBrowserModal';
import { DeckTile } from '@/components/DeckTile';
import { TCGIcon } from '@/components/TCGIcon';
import { supabase } from '@/lib/supabase';
import { Profile, UserTCG, TCGId, UserDeck } from '@/types';

const PLACEHOLDER_BIO = 'Dieser Spieler hat noch keine Bio hinzugefügt.';

const ENGAGEMENT_STATS = [
  { value: '—', label: 'Events' },
  { value: '—', label: 'Gegner' },
  { value: '—', label: 'Turniere' },
  { value: '—', label: 'Bewertung' },
];

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [tcgs, setTcgs]             = useState<UserTCG[]>([]);
  const [tcgDetails, setTcgDetails] = useState<Record<string, string>>({});
  const [activeTCG, setActiveTCG]   = useState<TCGId | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [decks, setDecks]           = useState<UserDeck[]>([]);
  const [browserOpen, setBrowserOpen]     = useState(false);
  const [browserInitialDeckId, setBrowserInitialDeckId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    const [{ data: p, error: pe }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('user_tcgs').select('*').eq('user_id', id).order('tcg'),
    ]);
    if (pe || !p) { setNotFound(true); return; }
    setProfile(p);
    const list = (t ?? []) as UserTCG[];
    setTcgs(list);
    setActiveTCG(list[0]?.tcg as TCGId ?? null);
  }, [id]);

  useEffect(() => { fetchProfile().finally(() => setLoading(false)); }, [fetchProfile]);

  const fetchTCGDetails = useCallback(async (tcg: TCGId) => {
    if (!id) return;
    const { data } = await supabase
      .from('user_tcg_details').select('*')
      .eq('user_id', id).eq('tcg', tcg).single();
    setTcgDetails((data?.details as Record<string, string>) ?? {});
  }, [id]);

  const fetchDecks = useCallback(async (tcg: TCGId) => {
    if (!id) return;
    const { data } = await supabase
      .from('user_decks').select('*')
      .eq('user_id', id).eq('tcg', tcg)
      .order('created_at', { ascending: false });
    setDecks((data ?? []) as UserDeck[]);
  }, [id]);

  useEffect(() => {
    if (!activeTCG) return;
    fetchTCGDetails(activeTCG);
    fetchDecks(activeTCG);
  }, [activeTCG, fetchTCGDetails, fetchDecks]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.iconBtnPressed]}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFoundTitle}>Spieler nicht gefunden</Text>
          <Text style={styles.notFoundSub}>Dieses Profil existiert nicht.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeTCGInfo   = activeTCG ? TCG_MAP[activeTCG] : null;
  const activeTCGSkill  = tcgs.find(t => t.tcg === activeTCG)?.skill_level ?? 0;
  const fields          = activeTCG ? TCG_FIELDS[activeTCG] : [];
  const avgSkill        = tcgs.length
    ? Math.round(tcgs.reduce((s, t) => s + t.skill_level, 0) / tcgs.length)
    : 0;
  const handle          = (profile.username ?? 'spieler').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const memberSince     = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── DS TopBar ── */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.iconBtnPressed]}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── DS ProfileCard — identity block ── */}
        <View style={styles.profileCard}>
          {/* Avatar (non-interactive) */}
          <View style={styles.avatarWrap}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(profile.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>

          {/* Name + handle */}
          <View style={styles.nameRow}>
            <Text style={styles.username}>{profile.username ?? '—'}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✦</Text>
            </View>
          </View>
          <Text style={styles.handle}>@{handle}</Text>
          <Text style={styles.bio}>{PLACEHOLDER_BIO}</Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            {!!profile.region && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>{profile.region}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>Seit {memberSince}</Text>
            </View>
          </View>

          {/* Social action buttons */}
          <View style={styles.actionBlock}>
            <Pressable
              style={({ pressed }) => [styles.actionPrimary, pressed && styles.actionPrimaryPressed]}
              onPress={() => {}}
            >
              <Text style={styles.actionPrimaryText}>Nachricht</Text>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.actionSecondary, pressed && styles.actionSecondaryPressed]}
                onPress={() => {}}
              >
                <Text style={styles.actionSecondaryText}>+ Freund</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionSecondary, pressed && styles.actionSecondaryPressed]}
                onPress={() => {}}
              >
                <Text style={styles.actionSecondaryText}>Event</Text>
              </Pressable>
            </View>
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
              const info   = TCG_MAP[t.tcg as TCGId];
              const isActive = t.tcg === activeTCG;
              return (
                <Pressable
                  key={t.tcg}
                  onPress={() => setActiveTCG(t.tcg as TCGId)}
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

        {/* ── Spielerlevel card (static/placeholder) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionLabel}>SPIELERLEVEL</Text>
            <View style={styles.levelBadge}>
              <View style={styles.levelBadgeDiamond} />
              <Text style={styles.levelBadgeGlyph}>★</Text>
            </View>
          </View>
          <View style={styles.levelValueRow}>
            <Text style={styles.levelValue}>Lv. —</Text>
            <Text style={styles.levelXpText}>Noch kein Rang</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: '0%' as any }]} />
          </View>
          <View style={styles.engagementRow}>
            {ENGAGEMENT_STATS.map(s => (
              <View key={s.label} style={styles.engagementCell}>
                <Text style={styles.engagementValue}>{s.value}</Text>
                <Text style={styles.engagementLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TCG-specific content (read-only) ── */}
        {activeTCG && activeTCGInfo && (
          <View style={styles.tcgContent}>

            {/* Skill bar — read-only */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SKILLSTUFE</Text>
              <View style={styles.skillBar}>
                {Array.from({ length: 10 }, (_, i) => (
                  <View
                    key={i}
                    style={[styles.skillSeg, i < activeTCGSkill && styles.skillSegFilled]}
                  />
                ))}
                <Text style={styles.skillNum}>{activeTCGSkill}/10</Text>
              </View>
            </View>

            {/* Decks — read-only view */}
            <View style={styles.deckSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>DECKS ({decks.length})</Text>
              </View>

              {decks.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.deckRow}
                  >
                    {decks.map(deck => (
                      <DeckTile
                        key={deck.id}
                        deck={deck}
                        tcgInfo={activeTCGInfo}
                        onPress={() => {
                          setBrowserInitialDeckId(deck.id);
                          setBrowserOpen(true);
                        }}
                        editing={false}
                      />
                    ))}
                  </ScrollView>
                  <Pressable
                    style={({ pressed }) => [styles.viewAllBtn, pressed && styles.viewAllBtnPressed]}
                    onPress={() => {
                      setBrowserInitialDeckId(null);
                      setBrowserOpen(true);
                    }}
                  >
                    <Text style={styles.viewAllBtnText}>
                      Alle {decks.length} Decks anzeigen ›
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>Noch keine Decks</Text>
                </View>
              )}
            </View>

            {/* TCG field blocks — read-only */}
            {fields.map(field => {
              const val = tcgDetails[field.key] ?? '';
              return (
                <View key={field.key} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>

                  {field.type === 'manaColor' ? (
                    <View style={styles.manaRow}>
                      {MTG_COLORS.map(c => {
                        const isSel = val === c.id;
                        return (
                          <View
                            key={c.id}
                            style={[styles.manaBtn, !isSel && { opacity: 0.25 }]}
                          >
                            <ManaSymbol manaId={c.id} size={40} />
                            <Text style={styles.manaLabel}>{c.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : field.type === 'playStyle' ? (
                    <View style={styles.styleRow}>
                      {PLAY_STYLES.map(s => {
                        const isSel = val === s.id;
                        return (
                          <View
                            key={s.id}
                            style={[styles.styleBtn, isSel && styles.styleBtnActive, !isSel && { opacity: 0.4 }]}
                          >
                            <Text style={[styles.styleBtnText, isSel && styles.styleBtnTextActive]}>
                              {s.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={val ? styles.fieldValue : styles.fieldEmpty}>
                      {val || '—'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {tcgs.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Dieser Spieler hat noch keine TCGs eingetragen.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Read-only deck browser */}
      {activeTCGInfo && (
        <DeckBrowserModal
          visible={browserOpen}
          onClose={() => setBrowserOpen(false)}
          decks={decks}
          tcgInfo={activeTCGInfo}
          initialDeckId={browserInitialDeckId}
          editing={false}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 32 },
    center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },

    notFoundTitle: { color: C.text,     fontSize: 18, fontFamily: FONTS.bold,    textAlign: 'center' },
    notFoundSub:   { color: C.textFaint, fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center' },

    // DS TopBar
    topBar: {
      height:            56,
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    backText:      { color: C.text, fontSize: 22, fontFamily: FONTS.bold, lineHeight: 28 },
    iconBtnPressed: { backgroundColor: C.surface3 },
    pageTitle:     { color: C.text, fontSize: 17, fontFamily: FONTS.bold },

    // Profile identity card
    profileCard: {
      marginHorizontal: 16,
      backgroundColor:  C.surface,
      borderWidth:      1,
      borderColor:      C.border,
      borderRadius:     20,
      padding:          20,
      marginBottom:     12,
      alignItems:       'center',
      gap:              8,
      ...ELEVATION.panel,
    },

    // Avatar (view, not pressable)
    avatarWrap: { position: 'relative', marginBottom: 4 },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: C.surface2,
    },
    avatarFallback: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: C.surface2,
      borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial:  { color: C.primary, fontSize: 32, fontFamily: FONTS.bold },
    onlineDot: {
      position: 'absolute', bottom: 4, right: 4,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: C.success,
      borderWidth: 2, borderColor: C.surface,
    },

    // Name + handle + bio
    nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    username:   { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22 },
    verifiedBadge: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    verifiedBadgeText: { color: '#fff', fontSize: 9, fontFamily: FONTS.bold },
    handle: { color: C.textFaint, fontSize: 13, fontFamily: FONTS.regular },
    bio: {
      color: C.textMuted, fontSize: 13, fontFamily: FONTS.regular,
      textAlign: 'center', lineHeight: 19, maxWidth: 280,
    },

    // Meta row
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    metaItem: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.surface2, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    metaText: { color: C.textMuted, fontSize: 12, fontFamily: FONTS.regular },

    // Social action buttons — stacked: primary full-width, then secondary pair
    actionBlock:  { alignSelf: 'stretch', gap: 8, marginTop: 4 },
    actionRow:    { flexDirection: 'row', gap: 8 },
    actionPrimary: {
      height: 40,
      backgroundColor: C.primary,
      borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3, shadowRadius: 6,
    },
    actionPrimaryPressed:    { backgroundColor: C.primaryDeep },
    actionPrimaryText:       { color: '#fff', fontSize: 14, fontFamily: FONTS.semibold },
    actionSecondary: {
      flex: 1, height: 38,
      backgroundColor: C.surface2,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 8,
    },
    actionSecondaryPressed:  { backgroundColor: C.surface3 },
    actionSecondaryText:     { color: C.text, fontSize: 13, fontFamily: FONTS.semibold },

    // Stat strip (DS StatCard row)
    statStrip: {
      flexDirection:    'row',
      marginHorizontal: 16,
      backgroundColor:  C.surface,
      borderWidth:      1,
      borderColor:      C.border,
      borderRadius:     14,
      marginBottom:     12,
      ...ELEVATION.panel,
    },
    statCell: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, gap: 3,
    },
    statDivider: { width: 1, backgroundColor: C.border, marginVertical: 10 },
    statValue:   { color: C.text,     fontSize: 18, fontFamily: FONTS.bold },
    statLabel:   { color: C.textFaint, fontSize: 10, fontFamily: FONTS.semibold, letterSpacing: 0.5 },
    tcgEmojis:   { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 20 },

    // TCG selector pills
    tcgPillsWrap: { marginBottom: 12 },
    tcgPillsRow:  { paddingHorizontal: 16, gap: 8 },
    tcgPill: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               6,
      height:            32,
      paddingHorizontal: 12,
      backgroundColor:   C.surface,
      borderWidth:       1,
      borderColor:       C.border,
      borderRadius:      16,
    },
    tcgPillActive:       { backgroundColor: C.primaryTint, borderColor: C.primary },
    tcgPillPressed:      { backgroundColor: C.surface2 },
    tcgPillText:         { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
    tcgPillTextActive:   { color: C.primaryBright },

    // DS Card
    card: {
      marginHorizontal: 16,
      backgroundColor:  C.surface,
      borderWidth:      1,
      borderColor:      C.border,
      borderRadius:     14,
      padding:          16,
      marginBottom:     12,
      gap:              12,
      ...ELEVATION.panel,
    },
    cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: {
      color: C.textFaint, fontSize: 11, fontFamily: FONTS.semibold,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },

    // Level badge
    levelBadge: {
      width: 32, height: 32,
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    },
    levelBadgeDiamond: {
      position: 'absolute',
      width: 24, height: 24,
      backgroundColor: C.primaryTint,
      borderWidth: 1.5, borderColor: C.primary,
      borderRadius: 6,
      transform: [{ rotate: '45deg' }],
    },
    levelBadgeGlyph: { color: C.primary, fontSize: 13, fontFamily: FONTS.bold, zIndex: 1 },

    levelValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    levelValue:    { color: C.text,     fontSize: 28, fontFamily: FONTS.bold },
    levelXpText:   { color: C.textFaint, fontSize: 12, fontFamily: FONTS.regular },

    // XP progress bar
    xpTrack: {
      height: 6, backgroundColor: C.surface2,
      borderRadius: 3, overflow: 'hidden',
    },
    xpFill: {
      height: '100%',
      backgroundColor: C.primary,
      borderRadius: 3,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5, shadowRadius: 4,
    },

    // Engagement stats
    engagementRow: { flexDirection: 'row', justifyContent: 'space-around' },
    engagementCell: { alignItems: 'center', gap: 3 },
    engagementValue: { color: C.text,     fontSize: 18, fontFamily: FONTS.bold,    fontVariant: ['tabular-nums'] },
    engagementLabel: { color: C.textFaint, fontSize: 10, fontFamily: FONTS.semibold, letterSpacing: 0.4 },

    tcgContent: { gap: 0 },

    // Skill bar (read-only)
    skillBar: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    skillSeg: {
      flex: 1, height: 6, borderRadius: 3,
      backgroundColor: C.surface2,
    },
    skillSegFilled: { backgroundColor: C.primary },
    skillNum: {
      color: C.textMuted, fontSize: 11, fontFamily: FONTS.semibold,
      marginLeft: 6, minWidth: 28, textAlign: 'right',
    },

    // Decks section
    deckSection: {
      marginHorizontal: 16,
      marginBottom:     12,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    deckRow: { gap: 12, paddingBottom: 4 },
    viewAllBtn: {
      marginTop: 8,
      height: 40,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    viewAllBtnPressed:  { backgroundColor: C.surface2 },
    viewAllBtnText:     { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },

    emptyText: { color: C.textFaint, fontSize: 13, fontFamily: FONTS.regular, textAlign: 'center' },

    // TCG field blocks (read-only)
    fieldBlock: {
      marginHorizontal: 16,
      backgroundColor:  C.surface,
      borderWidth:      1,
      borderColor:      C.border,
      borderRadius:     14,
      padding:          16,
      marginBottom:     12,
      gap:              10,
      ...ELEVATION.panel,
    },
    fieldLabel: { color: C.textFaint, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.5 },
    fieldValue: { color: C.text,     fontSize: 14, fontFamily: FONTS.regular },
    fieldEmpty: { color: C.textFaint, fontSize: 14, fontFamily: FONTS.regular },

    manaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    manaBtn: { alignItems: 'center', gap: 4 },
    manaLabel: { color: C.textMuted, fontSize: 10, fontFamily: FONTS.semibold },

    styleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    styleBtn: {
      paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor:   C.surface2,
      borderWidth:       1, borderColor: C.border,
      borderRadius:      8,
    },
    styleBtnActive:    { backgroundColor: C.primaryTint, borderColor: C.primary },
    styleBtnText:      { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
    styleBtnTextActive: { color: C.primaryBright },
  });
}

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { TCG_MAP, TCG_FIELDS, MTG_COLORS, PLAY_STYLES } from '@/constants/tcgs';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { ManaSymbol } from '@/components/icons';
import { DeckImportModal } from '@/components/DeckImportModal';
import { DeckBrowserModal } from '@/components/DeckBrowserModal';
import { DeckTile } from '@/components/DeckTile';
import { supabase } from '@/lib/supabase';
import { uploadAvatar, signOut } from '@/lib/auth';
import { Profile, UserTCG, TCGId, UserDeck } from '@/types';

// ─── Design-only placeholder content (mirrors the reference mockup; no backing data yet) ───
const PLACEHOLDER_BIO = 'Sammle seit Jahren Karten, liebe enge Matches und ziehe nach jedem Turnier ein neues Deck aus dem Hut. Immer offen für eine Partie.';

const PLAYER_LEVEL = 24;
const PLAYER_XP = 2350;
const PLAYER_XP_NEXT = 3000;

const ENGAGEMENT_STATS = [
  { icon: '🎮', value: '72', label: 'Events besucht' },
  { icon: '👥', value: '143', label: 'Gegner gespielt' },
  { icon: '🏆', value: '28', label: 'Turniere' },
  { icon: '⭐', value: '4.8', label: 'Bewertung' },
];

const TCG_START_DATE_PLACEHOLDER = 'Januar 2021';

const PLACEHOLDER_ACTIVITY = {
  icon: '🎲',
  lead: 'Nimmt teil an',
  highlight: 'Commander Night',
  meta: 'Heute, 19:00',
};

export default function ProfileScreen() {
  const { colors: C, scheme, toggleScheme } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tcgs, setTcgs] = useState<UserTCG[]>([]);
  const [tcgDetails, setTcgDetails] = useState<Record<string, string>>({});
  const [activeTCG, setActiveTCG] = useState<TCGId | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDetails, setEditDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editSkill, setEditSkill] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserInitialDeckId, setBrowserInitialDeckId] = useState<string | null>(null);

  const openDeckBrowser = (deckId: string | null = null) => {
    setBrowserInitialDeckId(deckId);
    setBrowserOpen(true);
  };

  const openDeckImportFromBrowser = () => {
    setBrowserOpen(false);
    setImportOpen(true);
  };

  const handleImportedDeck = (deck: UserDeck) => {
    setDecks(prev => [deck, ...prev]);
  };

  const handleDeckUpdated = (deck: UserDeck) => {
    setDecks(prev => prev.map(d => (d.id === deck.id ? deck : d)));
  };

  const deleteDeck = async (deck: UserDeck) => {
    setDecks(prev => prev.filter(d => d.id !== deck.id));
    const { error } = await supabase.from('user_decks').delete().eq('id', deck.id);
    if (error) console.error('deleteDeck failed:', error);
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
      const { error: skillError } = await supabase
        .from('user_tcgs')
        .update({ skill_level: editSkill })
        .eq('user_id', session.user.id)
        .eq('tcg', activeTCG);
      if (skillError) throw skillError;
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
    { icon: '📊', value: '61%', label: 'Winrate' },
    { icon: '🃏', value: String(decks.length), label: 'Decks' },
    { icon: '⏱️', value: '312h', label: 'Gesamtspielzeit' },
    { icon: '📈', value: '3', label: 'Top 8 Finishes' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Page header ── */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Profil</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.signOutCircle} onPress={() => {}} activeOpacity={0.7}>
              <Text style={styles.signOutArrow}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutCircle} onPress={() => {}} activeOpacity={0.7}>
              <Text style={styles.signOutArrow}>⋯</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutCircle} onPress={toggleScheme}>
              <Text style={styles.signOutArrow}>{scheme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutCircle} onPress={() => signOut()}>
              <Text style={styles.signOutArrow}>↪</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Avatar + info ── */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
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
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.username}>{profile?.username ?? '—'}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✦</Text>
            </View>
          </View>
          <Text style={styles.handle}>@{handle}</Text>
          <Text style={styles.bio}>{PLACEHOLDER_BIO}</Text>

          <View style={styles.metaRow}>
            {!!profile?.region && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>📍</Text>
                <Text style={styles.metaText}>{profile.region}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={styles.metaText}>Mitglied seit {memberSince}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionPrimary} onPress={() => {}} activeOpacity={0.85}>
              <Text style={styles.actionPrimaryText}>Nachricht</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionOutline} onPress={() => {}} activeOpacity={0.85}>
              <Text style={styles.actionOutlineText}>Freund hinzufügen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionOutline} onPress={() => {}} activeOpacity={0.85}>
              <Text style={styles.actionOutlineText}>Gemeinsames Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{tcgs.length}</Text>
            <Text style={styles.statLabel}>TCGs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{avgSkill > 0 ? avgSkill : '—'}</Text>
            <Text style={styles.statLabel}>Ø Level</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={styles.tcgEmojis}>
              {tcgs.slice(0, 4).map(t => (
                <Text key={t.tcg} style={styles.tcgEmoji}>
                  {TCG_MAP[t.tcg as TCGId].emoji}
                </Text>
              ))}
            </View>
            <Text style={styles.statLabel}>Spiele</Text>
          </View>
        </View>

        {/* ── TCG selector pills ── */}
        {tcgs.length > 0 && (
          <View style={styles.tcgPillsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tcgPillsRow}>
              {tcgs.map(t => {
                const info = TCG_MAP[t.tcg as TCGId];
                const isActive = t.tcg === activeTCG;
                return (
                  <TouchableOpacity
                    key={t.tcg}
                    onPress={() => { setActiveTCG(t.tcg as TCGId); setEditing(false); }}
                    style={[styles.tcgPill, isActive && styles.tcgPillActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tcgPillEmoji}>{info.emoji}</Text>
                    <Text style={[styles.tcgPillText, isActive && styles.tcgPillTextActive]} numberOfLines={1}>
                      {info.name.split(':')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Spielerlevel ── */}
        <View style={styles.levelCard}>
          <View style={styles.levelCardTop}>
            <Text style={styles.cardEyebrow}>SPIELERLEVEL</Text>
            <View style={styles.levelBadge}>
              <View style={styles.levelBadgeWingL} />
              <View style={styles.levelBadgeWingR} />
              <View style={styles.levelBadgeDiamond} />
              <Text style={styles.levelBadgeGlyph}>★</Text>
            </View>
          </View>
          <View style={styles.levelValueRow}>
            <Text style={styles.levelValue}>Lv. {PLAYER_LEVEL}</Text>
            <Text style={styles.levelXpText}>
              {PLAYER_XP.toLocaleString('de-DE')} / {PLAYER_XP_NEXT.toLocaleString('de-DE')} XP
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
          </View>

          <View style={styles.engagementRow}>
            {ENGAGEMENT_STATS.map(s => (
              <View key={s.label} style={styles.engagementItem}>
                <Text style={styles.engagementIcon}>{s.icon}</Text>
                <Text style={styles.engagementValue}>{s.value}</Text>
                <Text style={styles.engagementLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TCG content ── */}
        {activeTCG && activeTCGInfo && (
          <View style={styles.tcgContent}>

            {/* Seit Beginn bei … */}
            <View style={[styles.sinceCard, { borderColor: activeTCGInfo.color + '33' }]}>
              <Text style={styles.sinceTitle}>
                Seit Beginn bei {activeTCGInfo.name.split(':')[0]} · {TCG_START_DATE_PLACEHOLDER}
              </Text>
              <View style={styles.engagementRow}>
                {tcgStartStats.map(s => (
                  <View key={s.label} style={styles.engagementItem}>
                    <Text style={styles.engagementIcon}>{s.icon}</Text>
                    <Text style={styles.engagementValue}>{s.value}</Text>
                    <Text style={styles.engagementLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Skill bar */}
            <View style={styles.skillSection}>
              <Text style={styles.fieldLabel}>Skillstufe</Text>
              <View style={styles.skillBar}>
                {Array.from({ length: 10 }, (_, i) => {
                  const displaySkill = editing ? editSkill : activeTCGSkill;
                  const filled = i < displaySkill;
                  if (editing) {
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.skillSeg, styles.skillSegEditable, filled && { backgroundColor: C.primary }]}
                        onPress={() => setEditSkill(i + 1)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 14, bottom: 14 }}
                      />
                    );
                  }
                  return (
                    <View key={i} style={[styles.skillSeg, filled && { backgroundColor: C.primary }]} />
                  );
                })}
                <Text style={styles.skillNum}>{editing ? editSkill : activeTCGSkill}/10</Text>
              </View>
            </View>

            {/* Edit actions */}
            <View style={styles.sectionActions}>
              {editing ? (
                <>
                  <TouchableOpacity onPress={() => { setEditDetails(tcgDetails); setEditSkill(activeTCGSkill); setEditing(false); }}>
                    <Text style={styles.cancelText}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveDetails} disabled={saving} style={styles.saveBtn}>
                    {saving
                      ? <ActivityIndicator color={C.text} size="small" />
                      : <Text style={styles.saveBtnText}>Speichern</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => { setEditDetails(tcgDetails); setEditSkill(activeTCGSkill); setEditing(true); }}
                >
                  <Text style={styles.editBtnText}>Bearbeiten</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Decks */}
            <View style={styles.decksSection}>
              <View style={styles.decksHeader}>
                <Text style={styles.cardEyebrow}>DECKS ({decks.length})</Text>
                <TouchableOpacity onPress={() => setImportOpen(true)}>
                  <Text style={styles.viewAllText}>+ Deck importieren</Text>
                </TouchableOpacity>
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
                  <TouchableOpacity
                    style={styles.viewAllDecksBtn}
                    onPress={() => openDeckBrowser(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewAllDecksText}>Alle {decks.length} Decks anzeigen ›</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.fieldEmpty}>Noch keine Decks importiert</Text>
                  <TouchableOpacity
                    style={styles.importDeckBtn}
                    onPress={() => setImportOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.importDeckText}>+ Deck importieren</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Fields */}
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
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.manaBtn,
                              isSel && styles.manaBtnActive,
                              !isSel && { opacity: editing ? 0.65 : 0.35 },
                            ]}
                            onPress={() => editing && setEditDetails(p => ({ ...p, [field.key]: c.id }))}
                            disabled={!editing}
                            activeOpacity={0.75}
                          >
                            <ManaSymbol manaId={c.id} size={40} />
                            <Text style={styles.manaLabel}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : field.type === 'playStyle' ? (
                    <View style={styles.styleRow}>
                      {PLAY_STYLES.map(s => {
                        const isSel = displayVal === s.id;
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.styleBtn, isSel && styles.styleBtnActive, !isSel && { opacity: editing ? 0.65 : 0.4 }]}
                            onPress={() => editing && setEditDetails(p => ({ ...p, [field.key]: s.id }))}
                            disabled={!editing}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.styleBtnText, isSel && styles.styleBtnTextActive]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : editing ? (
                    <TextInput
                      style={[styles.fieldInput, field.type === 'multiline' && styles.multilineInput]}
                      value={editDetails[field.key] ?? ''}
                      onChangeText={v => setEditDetails(p => ({ ...p, [field.key]: v }))}
                      placeholderTextColor={C.textDim}
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
            <View style={styles.activitySection}>
              <View style={styles.decksHeader}>
                <Text style={styles.cardEyebrow}>LETZTE AKTIVITÄTEN</Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.viewAllText}>Alle anzeigen</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Text style={styles.activityIcon}>{PLACEHOLDER_ACTIVITY.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {PLACEHOLDER_ACTIVITY.lead} <Text style={styles.activityHighlight}>{PLACEHOLDER_ACTIVITY.highlight}</Text>
                  </Text>
                  <Text style={styles.activityMeta}>{PLACEHOLDER_ACTIVITY.meta}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {tcgs.length === 0 && (
          <View style={[styles.center, { padding: 40 }]}>
            <Text style={styles.emptyText}>Keine TCGs im Profil.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
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
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textMuted, fontSize: 15, textAlign: 'center' },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  pageTitle: {
    color: C.text,
    fontSize: 36,
    fontFamily: FONTS.black,
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  signOutCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutArrow: { color: C.textMuted, fontSize: 18 },

  /* Profile section */
  profileSection: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36, fontFamily: FONTS.extrabold, color: C.primary },
  cameraTag: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface2,
    borderWidth: 2,
    borderColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { color: C.text, fontSize: 22, fontFamily: FONTS.extrabold, marginBottom: 4 },
  location: { color: C.textMuted, fontSize: 14 },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.success,
    borderWidth: 2.5,
    borderColor: C.bg,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeText: { color: '#FFFFFF', fontSize: 10 },
  handle: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.medium, marginTop: 2 },
  bio: {
    color: C.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },

  /* Meta row */
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaIcon: { fontSize: 13 },
  metaText: { color: C.textMuted, fontSize: 12.5, fontFamily: FONTS.medium },

  /* Action buttons */
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 18 },
  actionPrimary: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  actionPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontFamily: FONTS.bold },
  actionOutline: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  actionOutlineText: { color: C.text, fontSize: 13.5, fontFamily: FONTS.semibold },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 20,
    marginHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { color: C.text, fontSize: 20, fontFamily: FONTS.extrabold },
  statLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontFamily: FONTS.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  tcgEmojis: { flexDirection: 'row', gap: 2 },
  tcgEmoji: { fontSize: 16 },

  /* TCG selector pills */
  tcgPillsWrap: { marginBottom: 22 },
  tcgPillsRow: { paddingHorizontal: 20, gap: 10 },
  tcgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.surface2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  tcgPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  tcgPillEmoji: { fontSize: 15 },
  tcgPillText: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
  tcgPillTextActive: { color: '#FFFFFF', fontFamily: FONTS.bold },

  /* Spielerlevel card */
  levelCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    gap: 12,
  },
  levelCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  levelBadgeDiamond: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
    transform: [{ rotate: '45deg' }],
  },
  levelBadgeWingL: {
    position: 'absolute',
    left: -3,
    width: 16,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.primaryLight,
    opacity: 0.45,
    transform: [{ rotate: '-30deg' }],
  },
  levelBadgeWingR: {
    position: 'absolute',
    right: -3,
    width: 16,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.primaryLight,
    opacity: 0.45,
    transform: [{ rotate: '30deg' }],
  },
  levelBadgeGlyph: { color: C.primary, fontSize: 16 },
  levelValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  levelValue: { color: C.text, fontSize: 22, fontFamily: FONTS.extrabold },
  levelXpText: { color: C.textMuted, fontSize: 12.5, fontFamily: FONTS.semibold },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: C.primary },

  engagementRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  engagementItem: { alignItems: 'center', gap: 3, flex: 1 },
  engagementIcon: { fontSize: 16 },
  engagementValue: { color: C.text, fontSize: 15, fontFamily: FONTS.extrabold },
  engagementLabel: { color: C.textMuted, fontSize: 9.5, fontFamily: FONTS.semibold, textAlign: 'center' },

  /* Seit-Beginn card */
  sinceCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  sinceTitle: { color: C.text, fontSize: 13.5, fontFamily: FONTS.bold },

  /* Activity feed */
  activitySection: { marginBottom: 12 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIcon: { fontSize: 18 },
  activityTitle: { color: C.text, fontSize: 13.5, fontFamily: FONTS.medium },
  activityHighlight: { color: C.primary, fontFamily: FONTS.bold },
  activityMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },

  /* TCG content */
  tcgContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  /* Skill bar */
  skillSection: { marginBottom: 20 },
  skillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  skillSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surface3,
  },
  skillSegEditable: {
    height: 8,
    borderRadius: 4,
  },
  skillNum: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: FONTS.semibold,
    marginLeft: 6,
    width: 30,
  },

  /* Actions */
  sectionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtnText: { color: C.textMuted, fontSize: 13, fontFamily: FONTS.semibold },
  cancelText: { color: C.textMuted, fontSize: 13 },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnText: { color: C.text, fontSize: 13, fontFamily: FONTS.bold },

  /* Fields */
  fieldBlock: { marginBottom: 22 },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fieldValue: { color: C.text, fontSize: 15 },
  fieldEmpty: { color: C.textDim, fontSize: 15 },
  fieldInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },

  /* Mana */
  manaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  manaBtn: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 52,
  },
  manaBtnActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
  },
  manaLabel: { color: C.textMuted, fontSize: 10, fontFamily: FONTS.semibold },

  /* Play style */
  styleRow: { flexDirection: 'row', gap: 8 },
  styleBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  styleBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  styleBtnText: { color: C.textMuted, fontSize: 14, fontFamily: FONTS.semibold },
  styleBtnTextActive: { color: C.text },

  /* Decks */
  decksSection: { marginBottom: 28 },
  decksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: { color: C.primary, fontSize: 13, fontFamily: FONTS.bold },
  deckRow: { gap: 14, paddingRight: 4 },
  viewAllDecksBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: C.surface2,
  },
  viewAllDecksText: { color: C.text, fontSize: 13, fontFamily: FONTS.semibold },
  importDeckBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  importDeckText: { color: C.primary, fontSize: 14, fontFamily: FONTS.bold },
  });
}

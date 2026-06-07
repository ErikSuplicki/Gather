import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { ManaSymbol } from '@/components/icons';
import { CardPicker, SelectedCard, CardGame } from '@/components/CardPicker';

function parseCards(val: unknown): SelectedCard[] {
  if (Array.isArray(val)) return val as SelectedCard[];
  if (typeof val !== 'string' || !val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}
import { supabase } from '@/lib/supabase';
import { uploadAvatar, signOut } from '@/lib/auth';
import { Profile, UserTCG, TCGId } from '@/types';

const C = {
  bg: '#111111',
  surface: '#1A1A1A',
  surface2: '#1C1C1C',
  border: '#2A2A2A',
  red: '#D4384A',
  white: '#FFFFFF',
  gray: '#888888',
  dim: '#444444',
};

export default function ProfileScreen() {
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGame, setPickerGame] = useState<CardGame>('mtg');
  const pickerFieldKeyRef = useRef('');

  const openCardPicker = (fieldKey: string) => {
    pickerFieldKeyRef.current = fieldKey;
    setPickerGame(activeTCG === 'mtg' ? 'mtg' : 'pokemon');
    setPickerOpen(true);
  };

  const handleCardSelect = (cards: SelectedCard[]) => {
    const key = pickerFieldKeyRef.current;
    setEditDetails(prev => ({
      ...prev,
      [key]: cards.length > 0 ? JSON.stringify(cards) : '',
    }));
  };

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_tcgs').select('*').eq('user_id', userId).order('tcg'),
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

  useEffect(() => { if (activeTCG) fetchTCGDetails(activeTCG); }, [activeTCG, fetchTCGDetails]);

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
      .then(() => { if (activeTCG) return fetchTCGDetails(activeTCG); })
      .finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={C.red} size="large" />
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
      >
        {/* ── Page header ── */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Profil</Text>
          <TouchableOpacity style={styles.signOutCircle} onPress={() => signOut()}>
            <Text style={styles.signOutArrow}>↪</Text>
          </TouchableOpacity>
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
            <View style={styles.cameraTag}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.username}>{profile?.username ?? '—'}</Text>
          {profile?.region ? (
            <Text style={styles.location}>📍  {profile.region}</Text>
          ) : null}
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

        {/* ── TCG sub-tabs (Riot underline style) ── */}
        {tcgs.length > 0 && (
          <View style={styles.tcgTabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tcgTabs}>
                {tcgs.map(t => {
                  const info = TCG_MAP[t.tcg as TCGId];
                  const isActive = t.tcg === activeTCG;
                  return (
                    <TouchableOpacity
                      key={t.tcg}
                      onPress={() => { setActiveTCG(t.tcg as TCGId); setEditing(false); }}
                      style={styles.tcgTab}
                    >
                      <Text style={[styles.tcgTabText, isActive && styles.tcgTabTextActive]}>
                        {info.name.split(':')[0]}
                      </Text>
                      <View style={[styles.tcgTabLine, isActive && styles.tcgTabLineActive]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.tabsDivider} />
          </View>
        )}

        {/* ── TCG content ── */}
        {activeTCG && activeTCGInfo && (
          <View style={styles.tcgContent}>

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
                        style={[styles.skillSeg, styles.skillSegEditable, filled && { backgroundColor: C.red }]}
                        onPress={() => setEditSkill(i + 1)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 14, bottom: 14 }}
                      />
                    );
                  }
                  return (
                    <View key={i} style={[styles.skillSeg, filled && { backgroundColor: C.red }]} />
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
                      ? <ActivityIndicator color={C.white} size="small" />
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

            {/* Fields */}
            {fields.map(field => {
              const displayVal = (editing ? editDetails : tcgDetails)[field.key] ?? '';
              return (
                <View key={field.key} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>

                  {field.type === 'cardPicker' ? (
                    <View>
                      {/* Card images — shown in both view and edit mode */}
                      {parseCards(displayVal).length > 0 && (
                        <View style={styles.cardRow}>
                          {parseCards(displayVal).map(c => (
                            <View key={c.id} style={styles.cardItem}>
                              <Image
                                source={{ uri: c.image }}
                                style={styles.cardPreview}
                                resizeMode="cover"
                              />
                              <Text style={styles.cardName} numberOfLines={2}>{c.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {parseCards(displayVal).length === 0 && !editing && (
                        <Text style={styles.fieldEmpty}>—</Text>
                      )}
                      {/* Edit / change button */}
                      {editing && (
                        <TouchableOpacity
                          style={styles.pickCardBtn}
                          onPress={() => openCardPicker(field.key)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.pickCardText}>
                            {parseCards(displayVal).length > 0
                              ? '✎  Karten ändern'
                              : '+ Karte auswählen'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : field.type === 'manaColor' ? (
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
                      placeholderTextColor={C.dim}
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
          </View>
        )}

        {tcgs.length === 0 && (
          <View style={[styles.center, { padding: 40 }]}>
            <Text style={styles.emptyText}>Keine TCGs im Profil.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CardPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleCardSelect}
        maxCards={4}
        initialCards={parseCards(editDetails[pickerFieldKeyRef.current] ?? '')}
        game={pickerGame}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.gray, fontSize: 15, textAlign: 'center' },

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
    color: C.white,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  signOutCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutArrow: { color: C.gray, fontSize: 18 },

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
  avatarInitial: { fontSize: 36, fontWeight: '800', color: C.red },
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
  username: { color: C.white, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  location: { color: C.gray, fontSize: 14 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 24,
  },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { color: C.white, fontSize: 20, fontWeight: '800' },
  statLabel: {
    color: C.gray,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, backgroundColor: '#2A2A2A', marginVertical: 4 },
  tcgEmojis: { flexDirection: 'row', gap: 2 },
  tcgEmoji: { fontSize: 16 },

  /* TCG underline tabs */
  tcgTabsWrap: { marginBottom: 0 },
  tcgTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 28,
  },
  tcgTab: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 0,
  },
  tcgTabText: {
    color: C.gray,
    fontSize: 15,
    fontWeight: '600',
    paddingBottom: 12,
  },
  tcgTabTextActive: {
    color: C.white,
    fontWeight: '700',
  },
  tcgTabLine: {
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    borderRadius: 1,
  },
  tcgTabLineActive: {
    backgroundColor: C.red,
  },
  tabsDivider: {
    height: 1,
    backgroundColor: '#222222',
    marginTop: 0,
  },

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
    backgroundColor: '#2A2A2A',
  },
  skillSegEditable: {
    height: 8,
    borderRadius: 4,
  },
  skillNum: {
    color: C.gray,
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtnText: { color: C.gray, fontSize: 13, fontWeight: '600' },
  cancelText: { color: C.gray, fontSize: 13 },
  saveBtn: {
    backgroundColor: C.red,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnText: { color: C.white, fontSize: 13, fontWeight: '700' },

  /* Fields */
  fieldBlock: { marginBottom: 22 },
  fieldLabel: {
    color: C.gray,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fieldValue: { color: C.white, fontSize: 15 },
  fieldEmpty: { color: C.dim, fontSize: 15 },
  fieldInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.white,
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
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  manaLabel: { color: C.gray, fontSize: 10, fontWeight: '600' },

  /* Play style */
  styleRow: { flexDirection: 'row', gap: 8 },
  styleBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  styleBtnActive: { backgroundColor: '#D4384A', borderColor: '#D4384A' },
  styleBtnText: { color: C.gray, fontSize: 14, fontWeight: '600' },
  styleBtnTextActive: { color: C.white },

  /* Card picker */
  cardRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 10 },
  cardItem: { alignItems: 'center', gap: 6, width: 100 },
  cardPreview: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  cardName: {
    color: C.gray,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickCardBtn: {
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  pickCardText: { color: C.red, fontSize: 14, fontWeight: '700' },
});

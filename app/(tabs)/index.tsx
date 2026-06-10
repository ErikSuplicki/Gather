import React, {
  useMemo, useState, useEffect, useCallback, useRef,
} from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable,
  Image, ActivityIndicator, ScrollView, Animated, PanResponder, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import WebView from 'react-native-webview';
import { FONTS, ThemeColors, ELEVATION, RADII } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { TCG_LIST, TCG_MAP } from '@/constants/tcgs';
import { TCGIcon, ICONS as TCG_ICON_SOURCES } from '@/components/TCGIcon';
import { SearchIcon } from '@/components/icons';
import { TCGId, Profile } from '@/types';
import { BRACKET_COLORS, CommanderBracket } from '@/lib/powerLevel';

// Great-circle distance between two lat/lng points, in kilometers.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RADIUS_MIN  = 10;
const RADIUS_MAX  = 200;
const RADIUS_STEP = 5;

// Resolves a TCG's logo asset (used by TCGIcon) to a URI usable in raw <img> tags
// (Leaflet divIcon HTML, both the web direct-DOM map and the native WebView map).
// On web, require() of an image already yields a string or { uri } — Image.resolveAssetSource
// (native-only) isn't available there.
function getTcgIconUri(tcgId: TCGId): string | null {
  const source = TCG_ICON_SOURCES[tcgId];
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && 'uri' in source) return (source as { uri: string }).uri;
  if (Platform.OS !== 'web') return Image.resolveAssetSource(source).uri;
  return null;
}

// ─── Placeholder events ───────────────────────────────────────────────────────

interface PlaceholderEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  players: number;
  maxPlayers: number;
  tcgId: TCGId;
  // Commander bracket (1-5) for MTG Commander events, null otherwise — used by the bracket filter.
  bracket: CommanderBracket | null;
  // Position relative to the user's location, so placeholder events always
  // appear "nearby" regardless of which region the signed-in profile is in.
  // Spread from ~0km to ~130km so the radius filter has a visible effect.
  latOffset: number;
  lngOffset: number;
}

const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  { id: '1', title: 'Commander Night',    location: 'Carta Magica Hamburg',  date: 'Sa, 14. Jun • 19:00', players: 12, maxPlayers: 16, tcgId: 'mtg',      bracket: 3,    latOffset: 0,     lngOffset: 0 },
  { id: '2', title: 'Pokémon League Cup', location: 'ToyTown Altona',        date: 'So, 15. Jun • 14:00', players: 8,  maxPlayers: 20, tcgId: 'pokemon',  bracket: null, latOffset: 0.05,  lngOffset: -0.03 },
  { id: '3', title: 'Lorcana Turnier',    location: 'Spielkiste Eppendorf',  date: 'Fr, 13. Jun • 18:30', players: 6,  maxPlayers: 8,  tcgId: 'lorcana',  bracket: null, latOffset: 0.15,  lngOffset: 0.08 },
  { id: '4', title: 'Yu-Gi-Oh! Regional', location: 'Comic Planet HH',       date: 'Sa, 14. Jun • 10:00', players: 24, maxPlayers: 32, tcgId: 'yugioh',   bracket: null, latOffset: 0.35,  lngOffset: -0.20 },
  { id: '5', title: 'MTG Prerelease',     location: 'Highlander Games',      date: 'So, 22. Jun • 12:00', players: 18, maxPlayers: 24, tcgId: 'mtg',      bracket: 2,    latOffset: -0.60, lngOffset: 0.50 },
  { id: '6', title: 'Star Wars Unlimited',location: 'Hive Games Hamburg',    date: 'Sa, 21. Jun • 15:00', players: 10, maxPlayers: 12, tcgId: 'starwars', bracket: null, latOffset: 1.00,  lngOffset: -0.90 },
];

// ─── Map HTML factory ─────────────────────────────────────────────────────────

function buildMapHtml(
  centerLat: number,
  centerLng: number,
  events: PlaceholderEvent[],
): string {
  const eventsJson = JSON.stringify(events.map(e => ({
    id: e.id,
    title: e.title,
    location: e.location,
    date: e.date,
    players: e.players,
    maxPlayers: e.maxPlayers,
    tcg: TCG_MAP[e.tcgId]?.abbr ?? e.tcgId.toUpperCase(),
    color: TCG_MAP[e.tcgId]?.color ?? '#168BFF',
    icon: getTcgIconUri(e.tcgId),
    lat: centerLat + e.latOffset,
    lng: centerLng + e.lngOffset,
  })));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;overflow:hidden;background:#0F1011;}
    #map{width:100%;height:100%;}
    .leaflet-tile-pane{filter:invert(100%) hue-rotate(200deg) brightness(0.88) contrast(0.68) saturate(0.5);}
    .pin-wrap{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:2.5px solid;box-shadow:0 0 14px rgba(0,0,0,0.5);}
    .pin-text{font-size:10px;font-weight:700;color:#fff;font-family:system-ui,sans-serif;letter-spacing:0.3px;}
    .pin-img{width:20px;height:20px;object-fit:contain;}
    .leaflet-popup-content-wrapper{background:#1B1C1D!important;border:1px solid #2A2B2D!important;border-radius:14px!important;box-shadow:0 16px 40px rgba(0,0,0,0.6)!important;padding:0!important;overflow:hidden;}
    .leaflet-popup-content{margin:0!important;width:220px!important;}
    .leaflet-popup-tip-container{display:none!important;}
    .leaflet-popup-close-button{color:#71777F!important;top:8px!important;right:8px!important;font-size:18px!important;padding:2px 6px!important;background:transparent!important;z-index:10;}
    .leaflet-control-attribution{display:none!important;}
    .leaflet-control-zoom{margin-right:12px!important;margin-bottom:12px!important;}
    .leaflet-control-zoom a{background:#1B1C1D!important;color:#F4F6F8!important;border-color:#2A2B2D!important;width:32px!important;height:32px!important;line-height:32px!important;font-size:16px!important;}
    .leaflet-control-zoom a:hover{background:#252627!important;}
    .leaflet-control-zoom-in{border-radius:8px 8px 0 0!important;}
    .leaflet-control-zoom-out{border-radius:0 0 8px 8px!important;}
    .pu{padding:14px;}
    .pu-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;margin-bottom:8px;font-family:system-ui;}
    .pu-title{font-size:14px;font-weight:700;color:#F4F6F8;margin-bottom:3px;font-family:system-ui;}
    .pu-loc{font-size:11px;color:#A7ADB5;margin-bottom:10px;font-family:system-ui;}
    .pu-row{display:flex;gap:14px;margin-bottom:12px;}
    .pu-lbl{font-size:9px;color:#71777F;letter-spacing:0.6px;text-transform:uppercase;font-family:system-ui;margin-bottom:2px;}
    .pu-val{font-size:13px;font-weight:600;color:#F4F6F8;font-family:system-ui;}
    .pu-bar{height:4px;background:#252627;border-radius:2px;overflow:hidden;margin-bottom:12px;}
    .pu-bar-fill{height:100%;border-radius:2px;}
    .pu-btn{width:100%;background:#168BFF;color:#fff;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;font-family:system-ui;letter-spacing:0.2px;}
    .pu-btn:hover{background:#0B5FBD;}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var events=${eventsJson};
var map=L.map('map',{center:[${centerLat},${centerLng}],zoom:13,zoomControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:''}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
events.forEach(function(ev){
  var inner=ev.icon?'<img class="pin-img" src="'+ev.icon+'"/>':'<span class="pin-text">'+ev.tcg+'</span>';
  var icon=L.divIcon({
    html:'<div class="pin-wrap" style="background:'+ev.color+'22;border-color:'+ev.color+'">'+inner+'</div>',
    className:'',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-20]
  });
  var fill=Math.round((ev.players/ev.maxPlayers)*100);
  var popup='<div class="pu">'
    +'<div class="pu-badge" style="background:'+ev.color+'22;color:'+ev.color+';border:1px solid '+ev.color+'44">'+ev.tcg+'</div>'
    +'<div class="pu-title">'+ev.title+'</div>'
    +'<div class="pu-loc">'+ev.location+'</div>'
    +'<div class="pu-row">'
    +'<div><div class="pu-lbl">Datum</div><div class="pu-val">'+ev.date.split(' ')[0].split(' • ')[0]+'</div></div>'
    +'<div><div class="pu-lbl">Uhrzeit</div><div class="pu-val">'+(ev.date.split(' • ')[1]||'')+'</div></div>'
    +'<div><div class="pu-lbl">Spieler</div><div class="pu-val">'+ev.players+'/'+ev.maxPlayers+'</div></div>'
    +'</div>'
    +'<div class="pu-bar"><div class="pu-bar-fill" style="width:'+fill+'%;background:'+ev.color+'"></div></div>'
    +'<button class="pu-btn" onclick="sel(\''+ev.id+'\')">Details anzeigen ›</button>'
    +'</div>';
  L.marker([ev.lat,ev.lng],{icon:icon}).bindPopup(popup,{maxWidth:240,closeButton:true}).addTo(map);
});
function sel(id){var d=JSON.stringify({type:'selectEvent',id:id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(d);}else{window.parent.postMessage(d,'*');}}
setTimeout(function(){map.invalidateSize();},150);
</script>
</body>
</html>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  user_tcgs: { tcg: string; skill_level: number }[];
}

interface Suggestion {
  id: string;
  username: string | null;
  avatar_url: string | null;
  region: string | null;
  user_tcgs: { tcg: string; skill_level: number }[];
  user_decks: { bracket: number | null }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PEEK_HEIGHT     = 58;
const FALLBACK_HEIGHT = 420;
// Collapsed state shows roughly half of the available height.
const COLLAPSED_RATIO = 0.5;
// Reserves space for the floating bottom nav bar (pill + protruding FAB), which
// now hovers over screen content instead of consuming layout space.
const NAV_BAR_CLEARANCE = 76;

// ─── Component ───────────────────────────────────────────────────────────────


export default function DiscoverScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [query, setQuery]                   = useState('');
  const [searchFocused, setSearchFocused]   = useState(false);
  const [results, setResults]               = useState<SearchResult[]>([]);
  const [searching, setSearching]           = useState(false);
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [selectedEvent, setSelectedEvent]   = useState<PlaceholderEvent | null>(null);

  // ── event filters (map + "Events in deiner Nähe" list only — text search is unaffected) ──
  const [filterTcg, setFilterTcg]           = useState<TCGId | null>(null);
  const [filterBracket, setFilterBracket]   = useState<CommanderBracket | null>(null);
  const [filterDate, setFilterDate]         = useState<string | null>(null);
  const [radiusKm, setRadiusKm]             = useState(50);

  const [leafletReady, setLeafletReady]     = useState(false);
  const [webMapEl, setWebMapEl]             = useState<any>(null);
  const webLeafletRef                       = useRef<any>(null);

  // ── bottom sheet animation ──
  // Expanded state reaches up to just below the search bar — measured via onLayout
  // rather than guessed from window height, since the tab bar also eats into it.
  const [containerHeight, setContainerHeight] = useState(0);
  const [headerHeight, setHeaderHeight]       = useState(0);
  // Collapsed state shows exactly the drag handle + the players row — measured too.
  const [handleHeight, setHandleHeight]   = useState(0);
  const [playersHeight, setPlayersHeight] = useState(0);
  const measuredRef = useRef(false);

  const expandedHeight = useMemo(() => {
    if (containerHeight > 0 && headerHeight > 0) {
      return Math.max(280, containerHeight - headerHeight - 8 - NAV_BAR_CLEARANCE);
    }
    return FALLBACK_HEIGHT;
  }, [containerHeight, headerHeight]);

  const translateExpanded  = 0;
  const translatePeek      = expandedHeight - PEEK_HEIGHT;
  const translateCollapsed = useMemo(() => {
    if (handleHeight > 0 && playersHeight > 0) {
      const visible = handleHeight + playersHeight + 12; // sheetList paddingTop + breathing room
      return Math.min(translatePeek, Math.max(translateExpanded, expandedHeight - visible));
    }
    return Math.round(expandedHeight * COLLAPSED_RATIO);
  }, [expandedHeight, handleHeight, playersHeight, translatePeek]);
  const snapPoints = [translateExpanded, translateCollapsed, translatePeek];
  const snapPointsRef = useRef(snapPoints);
  snapPointsRef.current = snapPoints;

  const sheetY   = useRef(new Animated.Value(translateCollapsed)).current;
  const currentY = useRef(translateCollapsed);

  const snapTo = useCallback((toValue: number) => {
    currentY.current = toValue;
    Animated.spring(sheetY, {
      toValue, useNativeDriver: true,
      damping: 22, stiffness: 220, mass: 0.8,
    }).start();
  }, [sheetY]);

  const snapSheet = useCallback((expand: boolean) => {
    const points = snapPointsRef.current;
    snapTo(expand ? points[0] : points[1]);
  }, [snapTo]);

  // Re-sync the sheet to its (now accurately measured) collapsed position once layout settles.
  useEffect(() => {
    if (containerHeight > 0 && headerHeight > 0 && handleHeight > 0 && playersHeight > 0 && !measuredRef.current) {
      measuredRef.current = true;
      currentY.current = translateCollapsed;
      sheetY.setValue(translateCollapsed);
    }
  }, [containerHeight, headerHeight, handleHeight, playersHeight, translateCollapsed, sheetY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
      onPanResponderGrant: () => {
        sheetY.stopAnimation(val => { currentY.current = val; });
      },
      onPanResponderMove: (_, { dy }) => {
        const points = snapPointsRef.current;
        const next = Math.max(
          points[0],
          Math.min(points[2], currentY.current + dy),
        );
        sheetY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const projected = currentY.current + dy + vy * 80;
        const points = snapPointsRef.current;
        const nearest = points.reduce((prev, curr) =>
          Math.abs(curr - projected) < Math.abs(prev - projected) ? curr : prev,
        );
        snapTo(nearest);
      },
    }),
  ).current;

  // ── data loading ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setCurrentProfile(p ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!currentProfile || !currentUserId) return;
    (async () => {
      const q = supabase
        .from('profiles')
        .select('id, username, avatar_url, region, user_tcgs(tcg, skill_level), user_decks(bracket)')
        .eq('onboarding_complete', true)
        .neq('id', currentUserId)
        .limit(10);
      if (currentProfile.region) q.eq('region', currentProfile.region);
      const { data, error } = await q;
      if (error) console.error('[Discover] suggestions query error:', error);
      setSuggestions((data ?? []) as Suggestion[]);
    })();
  }, [currentProfile, currentUserId]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, city, region, user_tcgs(tcg, skill_level)')
        .ilike('username', `%${q.trim()}%`)
        .eq('onboarding_complete', true)
        .limit(25);
      setResults((data ?? []) as SearchResult[]);
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const showSearch          = query.trim().length > 0 || searchFocused;
  const showRecommendations = searchFocused && query.trim().length === 0;
  const recommendedPlayers  = suggestions.slice(0, 2);
  const recommendedEvents   = PLACEHOLDER_EVENTS.slice(0, 2);
  const centerLat  = currentProfile?.latitude  ?? 53.5511;
  const centerLng  = currentProfile?.longitude ?? 9.9937;

  // Distinct event dates, in their original order, for the date filter chips.
  const dateOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    PLACEHOLDER_EVENTS.forEach(ev => {
      const day = ev.date.split(' • ')[0];
      if (!seen.has(day)) { seen.add(day); out.push(day); }
    });
    return out;
  }, []);

  // Events shown on the map + "Events in deiner Nähe" list, after applying the
  // TCG/bracket/date/radius filters. The text search above is unaffected.
  const visibleEvents = useMemo(() => {
    return PLACEHOLDER_EVENTS.filter(ev => {
      if (filterTcg && ev.tcgId !== filterTcg) return false;
      if (filterBracket != null && ev.bracket !== filterBracket) return false;
      if (filterDate && ev.date.split(' • ')[0] !== filterDate) return false;
      const dist = distanceKm(centerLat, centerLng, centerLat + ev.latOffset, centerLng + ev.lngOffset);
      return dist <= radiusKm;
    });
  }, [filterTcg, filterBracket, filterDate, radiusKm, centerLat, centerLng]);

  const mapHtml = useMemo(
    () => buildMapHtml(centerLat, centerLng, visibleEvents),
    [centerLat, centerLng, visibleEvents],
  );

  // ── Web Leaflet: inject CSS+JS into document head once ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if ((window as any).L) { setLeafletReady(true); return; }
    if (!document.getElementById('gather-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'gather-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const style = document.createElement('style');
      style.textContent = '.gather-map .leaflet-tile-pane{filter:invert(100%) hue-rotate(200deg) brightness(0.88) contrast(0.68) saturate(0.5);}'
        + '.gather-map .leaflet-control-attribution{display:none!important;}'
        + '.gather-map .leaflet-control-zoom a{background:#1B1C1D!important;color:#F4F6F8!important;border-color:#2A2B2D!important;}'
        + '.gather-map .leaflet-control-zoom{margin-right:12px!important;margin-bottom:12px!important;}'
        + '.gather-map .leaflet-popup-content-wrapper{background:#1B1C1D!important;border:1px solid #2A2B2D!important;border-radius:14px!important;box-shadow:0 16px 40px rgba(0,0,0,0.6)!important;padding:0!important;overflow:hidden;}'
        + '.gather-map .leaflet-popup-content{margin:0!important;width:220px!important;}'
        + '.gather-map .leaflet-popup-tip-container{display:none!important;}'
        + '.gather-map .leaflet-popup-close-button{color:#71777F!important;top:8px!important;right:8px!important;font-size:18px!important;padding:2px 6px!important;background:transparent!important;z-index:10;}'
        + '.gather-pu{padding:14px;}'
        + '.gather-pu-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;margin-bottom:8px;font-family:system-ui;}'
        + '.gather-pu-title{font-size:14px;font-weight:700;color:#F4F6F8;margin-bottom:3px;font-family:system-ui;}'
        + '.gather-pu-loc{font-size:11px;color:#A7ADB5;margin-bottom:10px;font-family:system-ui;}'
        + '.gather-pu-row{display:flex;gap:14px;margin-bottom:12px;}'
        + '.gather-pu-lbl{font-size:9px;color:#71777F;letter-spacing:0.6px;text-transform:uppercase;font-family:system-ui;margin-bottom:2px;}'
        + '.gather-pu-val{font-size:13px;font-weight:600;color:#F4F6F8;font-family:system-ui;}'
        + '.gather-pu-bar{height:4px;background:#252627;border-radius:2px;overflow:hidden;margin-bottom:12px;}'
        + '.gather-pu-bar-fill{height:100%;border-radius:2px;}'
        + '.gather-pu-btn{width:100%;background:#168BFF;color:#fff;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;font-family:system-ui;letter-spacing:0.2px;}'
        + '.gather-pu-btn:hover{background:#0B5FBD;}';
      document.head.appendChild(style);
    }
    if (!document.getElementById('gather-leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'gather-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // ── Web Leaflet: init map once div is mounted and library is ready ──
  useEffect(() => {
    if (!leafletReady || !webMapEl) return;
    const L = (window as any).L;
    if (webLeafletRef.current) { webLeafletRef.current.remove(); webLeafletRef.current = null; }
    const map = L.map(webMapEl, { center: [centerLat, centerLng], zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    (window as any).__gatherSelectEvent = (id: string) => {
      const ev = PLACEHOLDER_EVENTS.find(x => x.id === id) ?? null;
      setSelectedEvent(ev);
      snapSheet(true);
      map.closePopup();
    };
    visibleEvents.forEach(ev => {
      const tcg     = TCG_MAP[ev.tcgId];
      const color   = tcg?.color ?? '#168BFF';
      const abbr    = tcg?.abbr  ?? ev.tcgId.toUpperCase();
      const iconUri = getTcgIconUri(ev.tcgId);
      const inner   = iconUri
        ? `<img src="${iconUri}" style="width:20px;height:20px;object-fit:contain"/>`
        : `<span style="font-size:10px;font-weight:700;color:#fff;font-family:system-ui">${abbr}</span>`;
      const icon  = L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:2.5px solid ${color};background:${color}22;box-shadow:0 0 14px rgba(0,0,0,.5)">${inner}</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
      });
      const lat  = centerLat + ev.latOffset;
      const lng  = centerLng + ev.lngOffset;
      const fill = Math.round((ev.players / ev.maxPlayers) * 100);
      const [day, time] = ev.date.split(' • ');
      const popupHtml = `<div class="gather-pu">`
        + `<div class="gather-pu-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${abbr}</div>`
        + `<div class="gather-pu-title">${ev.title}</div>`
        + `<div class="gather-pu-loc">${ev.location}</div>`
        + `<div class="gather-pu-row">`
        + `<div><div class="gather-pu-lbl">Datum</div><div class="gather-pu-val">${day}</div></div>`
        + `<div><div class="gather-pu-lbl">Uhrzeit</div><div class="gather-pu-val">${time ?? ''}</div></div>`
        + `<div><div class="gather-pu-lbl">Spieler</div><div class="gather-pu-val">${ev.players}/${ev.maxPlayers}</div></div>`
        + `</div>`
        + `<div class="gather-pu-bar"><div class="gather-pu-bar-fill" style="width:${fill}%;background:${color}"></div></div>`
        + `<button class="gather-pu-btn" onclick="window.__gatherSelectEvent('${ev.id}')">Details anzeigen ›</button>`
        + `</div>`;
      L.marker([lat, lng], { icon }).bindPopup(popupHtml, { maxWidth: 240, closeButton: true }).addTo(map);
    });
    setTimeout(() => map.invalidateSize(), 100);
    webLeafletRef.current = map;
    return () => { if (webLeafletRef.current) { webLeafletRef.current.remove(); webLeafletRef.current = null; } };
  }, [leafletReady, webMapEl, centerLat, centerLng, visibleEvents, snapSheet]);

  // ── search result card ──
  const renderSearchItem = ({ item }: { item: SearchResult }) => {
    const isOwn  = item.id === currentUserId;
    const handle = (item.username ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const tcgs   = item.user_tcgs ?? [];
    return (
      <Pressable
        style={({ pressed }) => [styles.playerCard, pressed && styles.playerCardPressed]}
        onPress={() => {
          if (isOwn) router.push('/(tabs)/profile' as any);
          else router.push(`/profile/${item.id}` as any);
        }}
      >
        {item.avatar_url
          ? <Image source={{ uri: item.avatar_url }} style={styles.cardAvatar} />
          : <View style={styles.cardAvatarFallback}>
              <Text style={styles.cardAvatarInitial}>{(item.username?.[0] ?? '?').toUpperCase()}</Text>
            </View>
        }
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{item.username ?? '—'}</Text>
            {isOwn && <View style={styles.youBadge}><Text style={styles.youBadgeText}>Du</Text></View>}
          </View>
          <Text style={styles.cardHandle} numberOfLines={1}>@{handle}</Text>
          {!!item.region && <Text style={styles.cardMeta} numberOfLines={1}>{item.region}</Text>}
          {tcgs.length > 0 && (
            <View style={styles.cardTcgRow}>
              {tcgs.slice(0, 4).map((t: { tcg: string; skill_level: number }) => {
                const info = TCG_MAP[t.tcg as TCGId];
                if (!info) return null;
                return (
                  <View key={t.tcg} style={[styles.cardTcgBadge, { borderColor: info.color + '44' }]}>
                    <TCGIcon tcg={info} size={11} color={info.color} />
                    <Text style={[styles.cardTcgSkill, { color: info.color }]}>{t.skill_level}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </Pressable>
    );
  };

  // ── recommended event card (shown on search-bar focus) ──
  const renderEventRecommendation = (ev: PlaceholderEvent) => {
    const tcg = TCG_MAP[ev.tcgId];
    return (
      <Pressable
        key={ev.id}
        style={({ pressed }) => [styles.playerCard, pressed && styles.playerCardPressed]}
        onPress={() => {
          setSelectedEvent(ev);
          snapSheet(true);
          setQuery('');
          setSearchFocused(false);
        }}
      >
        <View style={[styles.cardAvatarFallback, { backgroundColor: tcg.color + '14', borderColor: tcg.color + '33' }]}>
          <TCGIcon tcg={tcg} size={24} color={tcg.color} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{ev.title}</Text>
          <Text style={styles.cardHandle} numberOfLines={1}>{ev.location}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{ev.date}</Text>
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      onLayout={e => setContainerHeight(e.nativeEvent.layout.height)}
    >

      {/* ── Map: absolutely fills the whole screen as base layer ── */}
      {Platform.OS === 'web' ? (
        <>
          <div
            ref={setWebMapEl}
            className="gather-map"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, isolation: 'isolate' } as any}
          />
          {/* Gradient scrim — darkens map behind UI elements, passes pointer events through */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 320,
            background: 'linear-gradient(to bottom, rgba(15,16,17,0.78) 0%, rgba(15,16,17,0.42) 40%, rgba(15,16,17,0.12) 70%, rgba(15,16,17,0) 100%)',
            zIndex: 9, pointerEvents: 'none',
          } as any} />
        </>
      ) : (
        <WebView
          source={{ html: mapHtml }}
          style={styles.map}
          scrollEnabled={false}
          onMessage={e => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === 'selectEvent') {
                const ev = PLACEHOLDER_EVENTS.find(x => x.id === msg.id) ?? null;
                setSelectedEvent(ev);
                snapSheet(true);
              }
            } catch { /* ignore */ }
          }}
        />
      )}

      {/* ── Header: TopBar + SearchBar (measured so the sheet knows how far it can expand) ── */}
      <View style={styles.headerWrap} onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Entdecken</Text>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchIconWrap}>
            <SearchIcon color={C.textFaint} size={16} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Suche Spieler oder Event..."
            placeholderTextColor={C.textFaint}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            autoCorrect={false}
            autoCapitalize="none"
            cursorColor={C.primary}
            selectionColor={C.primaryTint}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* ── Filters: TCG / Bracket / Date pills + radius slider (map + nearby list only) ── */}
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {TCG_LIST.map(tcg => {
              const active = filterTcg === tcg.id;
              return (
                <Pressable
                  key={tcg.id}
                  style={[styles.filterChip, active && { backgroundColor: tcg.color + '1A', borderColor: tcg.color + '66' }]}
                  onPress={() => setFilterTcg(active ? null : tcg.id)}
                >
                  <TCGIcon tcg={tcg} size={13} color={active ? tcg.color : C.textFaint} />
                  <Text style={[styles.filterChipText, active && { color: tcg.color }]}>{tcg.abbr}</Text>
                </Pressable>
              );
            })}

            <View style={styles.filterDivider} />

            {([1, 2, 3, 4, 5] as CommanderBracket[]).map(b => {
              const active = filterBracket === b;
              const color  = BRACKET_COLORS[b];
              return (
                <Pressable
                  key={b}
                  style={[styles.filterChip, active && { backgroundColor: color + '1A', borderColor: color + '66' }]}
                  onPress={() => setFilterBracket(active ? null : b)}
                >
                  <Text style={[styles.filterChipText, active && { color }]}>B{b}</Text>
                </Pressable>
              );
            })}

            <View style={styles.filterDivider} />

            {dateOptions.map(d => {
              const active = filterDate === d;
              return (
                <Pressable
                  key={d}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterDate(active ? null : d)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{d.replace(',', '')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.radiusRow}>
            <Text style={styles.radiusLabel}>Umkreis</Text>
            <RadiusSlider value={radiusKm} onChange={setRadiusKm} C={C} />
            <Text style={styles.radiusValue}>{radiusKm} km</Text>
          </View>
        </View>
      </View>

      {/* ── Search results (covers map while searching) ── */}
      {showSearch && (
        <View style={styles.searchCover}>
          {showRecommendations ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
              <Text style={styles.sectionLabel}>EMPFEHLUNGEN FÜR DICH</Text>
              {recommendedPlayers.map(p => (
                <View key={p.id}>
                  {renderSearchItem({ item: { ...p, city: null } })}
                </View>
              ))}
              {recommendedEvents.map(ev => renderEventRecommendation(ev))}
            </ScrollView>
          ) : searching ? (
            <View style={styles.center}>
              <View style={styles.noResultsCard}>
                <ActivityIndicator color={C.primary} />
              </View>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.center}>
              <View style={styles.noResultsCard}>
                <Text style={styles.noResultsText}>Kein Spieler gefunden</Text>
                <Text style={styles.noResultsSub}>Versuche einen anderen Namen</Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={renderSearchItem}
            />
          )}
        </View>
      )}

      {/* ── Draggable event bottom sheet (always visible, overlays map) ── */}
      <Animated.View
        style={[styles.sheet, { height: expandedHeight, transform: [{ translateY: sheetY }] }]}
      >
              {/* Drag handle */}
              <View
                {...panResponder.panHandlers}
                style={styles.sheetHandle}
                onLayout={e => setHandleHeight(e.nativeEvent.layout.height)}
              >
                <View style={styles.sheetPill} />
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>In deiner Nähe</Text>
                </View>
              </View>

              {/* Event list */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetList}
              >
                {/* Player suggestions */}
                <View style={styles.playersSection} onLayout={e => setPlayersHeight(e.nativeEvent.layout.height)}>
                  <Text style={styles.sectionLabel}>SPIELER IN DEINER NÄHE</Text>
                  {suggestions.length === 0 ? (
                    <Text style={styles.suggestionEmpty}>Noch keine Spieler in deiner Region gefunden</Text>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestionRow}
                    >
                      {suggestions.slice(0, 10).map(s => {
                        const tcgs     = s.user_tcgs ?? [];
                        const avgSkill = tcgs.length
                          ? Math.round(tcgs.reduce((sum, t) => sum + t.skill_level, 0) / tcgs.length)
                          : 0;
                        const bracketNums = (s.user_decks ?? [])
                          .map(d => d.bracket)
                          .filter((b): b is number => b != null);
                        const avgBracket = bracketNums.length
                          ? Math.min(5, Math.max(1, Math.round(bracketNums.reduce((a, b) => a + b, 0) / bracketNums.length))) as CommanderBracket
                          : null;
                        return (
                          <Pressable
                            key={s.id}
                            style={({ pressed }) => [styles.suggestionCard, pressed && { opacity: 0.75 }]}
                            onPress={() => router.push(`/profile/${s.id}` as any)}
                          >
                            {s.avatar_url
                              ? <Image source={{ uri: s.avatar_url }} style={styles.suggestionAvatar} />
                              : <View style={styles.suggestionAvatarFallback}>
                                  <Text style={styles.suggestionInitial}>{(s.username?.[0] ?? '?').toUpperCase()}</Text>
                                </View>
                            }
                            <Text style={styles.suggestionName} numberOfLines={1}>{s.username ?? '—'}</Text>
                            <View style={styles.suggestionTcgRow}>
                              {tcgs.slice(0, 3).map(t => {
                                const info = TCG_MAP[t.tcg as TCGId];
                                if (!info) return null;
                                return <TCGIcon key={t.tcg} tcg={info} size={11} color={info.color} />;
                              })}
                            </View>
                            <View style={styles.suggestionBadgeRow}>
                              {avgSkill > 0 && (
                                <View style={styles.suggestionStatRow}>
                                  <Text style={styles.suggestionStatLabel}>Skill</Text>
                                  <Text style={styles.suggestionStatValue}>{avgSkill}</Text>
                                </View>
                              )}
                              {avgBracket != null && (
                                <View style={[styles.suggestionBracketBadge, { backgroundColor: BRACKET_COLORS[avgBracket] + '22', borderColor: BRACKET_COLORS[avgBracket] + '66' }]}>
                                  <Text style={[styles.suggestionBracketText, { color: BRACKET_COLORS[avgBracket] }]}>B{avgBracket}</Text>
                                </View>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                <Text style={styles.sectionLabel}>EVENTS IN DEINER NÄHE</Text>
                {visibleEvents.length === 0 && (
                  <Text style={styles.suggestionEmpty}>Keine Events für die gewählten Filter</Text>
                )}
                {visibleEvents.map(ev => {
                  const tcg  = TCG_MAP[ev.tcgId];
                  const fill = ev.players / ev.maxPlayers;
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <Pressable
                      key={ev.id}
                      style={({ pressed }) => [
                        styles.eventCard,
                        isSelected && { borderColor: tcg.color + '66' },
                        pressed && styles.eventCardPressed,
                      ]}
                      onPress={() => setSelectedEvent(isSelected ? null : ev)}
                    >
                      {/* TCG accent bar */}
                      <View style={[styles.eventAccent, { backgroundColor: tcg.color }]} />

                      <View style={styles.eventBody}>
                        {/* Top row */}
                        <View style={styles.eventTopRow}>
                          <View style={[styles.eventTcgBadge, { backgroundColor: tcg.color + '1A', borderColor: tcg.color + '44' }]}>
                            <TCGIcon tcg={tcg} size={10} color={tcg.color} />
                            <Text style={[styles.eventTcgText, { color: tcg.color }]}>{tcg.abbr}</Text>
                          </View>
                          <Text style={styles.eventDate}>{ev.date.split(' • ')[0]}</Text>
                        </View>

                        {/* Title + location */}
                        <Text style={styles.eventTitle}>{ev.title}</Text>
                        <Text style={styles.eventLocation} numberOfLines={1}>{ev.location}</Text>

                        {/* Player bar */}
                        <View style={styles.eventFooter}>
                          <View style={styles.eventBarWrap}>
                            <View style={styles.eventBar}>
                              <View style={[styles.eventBarFill, { width: `${fill * 100}%` as any, backgroundColor: tcg.color }]} />
                            </View>
                            <Text style={styles.eventPlayers}>
                              {ev.players}/{ev.maxPlayers} Spieler
                            </Text>
                          </View>
                          <Text style={styles.eventTime}>{ev.date.split(' • ')[1]}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                <View style={{ height: 32 }} />
              </ScrollView>
      </Animated.View>

    </SafeAreaView>
  );
}

// ─── Radius slider — draggable dot on a line, RADIUS_MIN..RADIUS_MAX km ────────

function RadiusSlider({
  value, onChange, C,
}: { value: number; onChange: (v: number) => void; C: ThemeColors }) {
  const styles = useMemo(() => makeSliderStyles(C), [C]);

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const startValue = useRef(value);

  const pct = Math.min(1, Math.max(0, (value - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startValue.current = valueRef.current; },
      onPanResponderMove: (_, gesture) => {
        const tw = trackWidthRef.current;
        if (tw <= 0) return;
        const deltaPct = gesture.dx / tw;
        let next = startValue.current + deltaPct * (RADIUS_MAX - RADIUS_MIN);
        next = Math.round(next / RADIUS_STEP) * RADIUS_STEP;
        next = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, next));
        if (next !== valueRef.current) onChangeRef.current(next);
      },
    }),
  ).current;

  return (
    <View style={styles.track} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
      <View style={styles.trackLine} />
      <View style={[styles.trackFill, { width: `${pct * 100}%` as any }]} />
      <View style={[styles.thumb, { left: `${pct * 100}%` as any }]} {...panResponder.panHandlers}>
        <View style={styles.thumbDot} />
      </View>
    </View>
  );
}

function makeSliderStyles(C: ThemeColors) {
  return StyleSheet.create({
    track: {
      flex: 1, height: 32, justifyContent: 'center', position: 'relative',
    },
    trackLine: {
      height: 3, borderRadius: 2, backgroundColor: C.surface3,
    },
    trackFill: {
      position: 'absolute', left: 0, height: 3, borderRadius: 2, backgroundColor: C.primary,
    },
    thumb: {
      position: 'absolute', top: '50%',
      marginTop: -16, marginLeft: -16,
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    thumbDot: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: C.primary, borderWidth: 2, borderColor: C.bg,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
    },
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.bg, position: 'relative', overflow: 'hidden' },

    headerWrap: { position: 'relative', zIndex: 10 },

    // TopBar
    topBar: {
      height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
      zIndex: 10, position: 'relative',
    },
    title: { color: C.text, fontSize: 22, fontFamily: FONTS.bold, letterSpacing: -0.22 },

    // SearchBar
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', height: 40,
      zIndex: 10, position: 'relative',
      backgroundColor: C.surface2, borderWidth: 1, borderColor: C.borderFocus,
      borderRadius: 10, marginHorizontal: 16, paddingHorizontal: 12,
      gap: 8, marginBottom: 10,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
    },
    searchIconWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    searchInput: { flex: 1, color: C.text, fontFamily: FONTS.regular, fontSize: 14 },
    clearIcon:   { fontSize: 13, color: C.textFaint },

    // Filter bar (TCG / bracket / date pills + radius slider)
    filterBar: {
      zIndex: 10, position: 'relative', marginBottom: 14, gap: 10,
    },
    filterRow: {
      paddingHorizontal: 16, gap: 6, alignItems: 'center',
    },
    filterChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      height: 28, paddingHorizontal: 10,
      borderRadius: RADII.pill, borderWidth: 1,
      backgroundColor: C.surface, borderColor: C.border,
    },
    filterChipActive: {
      backgroundColor: C.primaryTint, borderColor: C.primary + '66',
    },
    filterChipText: {
      color: C.textMuted, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.2,
    },
    filterChipTextActive: { color: C.primaryBright },
    filterDivider: {
      width: 1, height: 16, backgroundColor: C.border, marginHorizontal: 2,
    },

    // Radius slider
    radiusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, height: 28,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: RADII.md, paddingHorizontal: 12,
    },
    radiusLabel: {
      color: C.textFaint, fontSize: 11, fontFamily: FONTS.semibold, letterSpacing: 0.3,
    },
    radiusValue: {
      color: C.text, fontSize: 12, fontFamily: FONTS.semibold, minWidth: 44, textAlign: 'right',
    },

    // Search results
    list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 60, paddingHorizontal: 16 },
    noResultsCard: {
      alignItems: 'center', gap: 6, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14,
      paddingVertical: 20, paddingHorizontal: 24, ...ELEVATION.panel,
    },
    noResultsText: { color: C.text,     fontSize: 15, fontFamily: FONTS.semibold },
    noResultsSub:  { color: C.textFaint, fontSize: 13, fontFamily: FONTS.regular },

    // Player card (search result)
    playerCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12,
      gap: 12, ...ELEVATION.panel,
    },
    playerCardPressed:   { backgroundColor: C.surface2 },
    cardAvatar:          { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface2 },
    cardAvatarFallback: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface2,
      borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    cardAvatarInitial: { color: C.primary, fontSize: 20, fontFamily: FONTS.bold },
    cardInfo:    { flex: 1, gap: 3 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardName:    { color: C.text, fontSize: 15, fontFamily: FONTS.bold, flexShrink: 1 },
    youBadge: {
      backgroundColor: C.primaryTint, borderWidth: 1, borderColor: C.primary,
      borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
    },
    youBadgeText: { color: C.primary, fontSize: 10, fontFamily: FONTS.semibold },
    cardHandle:   { color: C.textFaint, fontSize: 12, fontFamily: FONTS.regular },
    cardMeta:     { color: C.textMuted, fontSize: 12, fontFamily: FONTS.regular },
    cardTcgRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
    cardTcgBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1,
      borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: C.surface2,
    },
    cardTcgSkill: { fontSize: 11, fontFamily: FONTS.semibold },
    cardArrow:    { color: C.textFaint, fontSize: 20, fontFamily: FONTS.bold },

    // Player suggestions
    playersSection: { marginBottom: 16 },
    sectionLabel: {
      color: C.textFaint, fontSize: 10, fontFamily: FONTS.semibold,
      letterSpacing: 0.8, marginBottom: 10,
    },
    suggestionEmpty: {
      color: C.textFaint, fontSize: 12, fontFamily: FONTS.regular,
    },
    suggestionRow: { gap: 10 },
    suggestionCard: { alignItems: 'center', width: 68, gap: 5 },
    suggestionAvatar: {
      width: 60, height: 60, borderRadius: 30,
      borderWidth: 2, borderColor: C.border,
    },
    suggestionAvatarFallback: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: C.surface2, borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    suggestionInitial:  { color: C.primary, fontSize: 22, fontFamily: FONTS.bold },
    suggestionName:     { color: C.text, fontSize: 11, fontFamily: FONTS.semibold, textAlign: 'center', maxWidth: 68 },
    suggestionTcgRow:   { flexDirection: 'row', gap: 4, alignItems: 'center' },
    suggestionStatRow: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: C.primaryTint, borderWidth: 1, borderColor: C.primary + '44',
      borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    suggestionStatLabel: { color: C.textFaint, fontSize: 9, fontFamily: FONTS.semibold, letterSpacing: 0.4 },
    suggestionStatValue: { color: C.primaryBright, fontSize: 11, fontFamily: FONTS.bold },
    suggestionBadgeRow:  { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
    suggestionBracketBadge: {
      borderRadius: 5, borderWidth: 1,
      paddingHorizontal: 5, paddingVertical: 2,
    },
    suggestionBracketText: { fontSize: 10, fontFamily: FONTS.bold },

    // Map fills entire screen as base layer
    map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    // Search results float over the map while typing
    searchCover: { flex: 1, backgroundColor: 'transparent', zIndex: 10, position: 'relative' },

    // Bottom sheet
    sheet: {
      position: 'absolute', bottom: NAV_BAR_CLEARANCE, left: 0, right: 0, zIndex: 20,
      backgroundColor: C.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      borderWidth: 1, borderColor: C.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
    },
    sheetHandle: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 16, alignItems: 'center', gap: 10 },
    sheetPill: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong,
    },
    sheetHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    },
    sheetTitle: { color: C.text, fontSize: 14, fontFamily: FONTS.bold },
    sheetList: { paddingHorizontal: 12, gap: 8, paddingTop: 2 },

    // Event cards
    eventCard: {
      flexDirection: 'row', backgroundColor: C.surface2,
      borderWidth: 1, borderColor: C.border, borderRadius: 12,
      overflow: 'hidden', ...ELEVATION.panel,
    },
    eventCardPressed: { backgroundColor: C.surface3 },
    eventAccent:      { width: 4 },
    eventBody:        { flex: 1, padding: 12, gap: 4 },
    eventTopRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eventTcgBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    eventTcgText:    { fontSize: 10, fontFamily: FONTS.bold },
    eventDate:       { color: C.textFaint, fontSize: 11, fontFamily: FONTS.regular },
    eventTitle:      { color: C.text, fontSize: 13, fontFamily: FONTS.bold },
    eventLocation:   { color: C.textMuted, fontSize: 11, fontFamily: FONTS.regular },
    eventFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    eventBarWrap:    { flex: 1, gap: 3 },
    eventBar: {
      height: 3, backgroundColor: C.surface3, borderRadius: 2, overflow: 'hidden',
    },
    eventBarFill:    { height: '100%', borderRadius: 2 },
    eventPlayers:    { color: C.textFaint, fontSize: 10, fontFamily: FONTS.regular },
    eventTime:       { color: C.textMuted, fontSize: 11, fontFamily: FONTS.semibold },
  });
}

import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompassIcon, PersonIcon, FeedIcon, SocialIcon, PlusIcon } from '@/components/icons';
import { ThemeColors, ELEVATION, RADII } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

const PILL_HEIGHT = 50;
const FAB_SIZE    = 68;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const activeRouteName = state.routes[state.index].name;

  const goTo = (routeName: string) => {
    const route = state.routes.find((r: any) => r.name === routeName);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (activeRouteName !== routeName && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <>
      {/* Subtle fade — dims content behind the floating nav bar */}
      <LinearGradient
        colors={['rgba(15,16,17,0)', 'rgba(15,16,17,0.7)']}
        style={styles.bottomFade}
        pointerEvents="none"
      />
      <View
        style={[styles.wrapper, { bottom: Math.max(insets.bottom, 8) + 12 }]}
        pointerEvents="box-none"
      >
      <View style={styles.pill}>
        <View style={styles.tabGroup}>
          <Pressable style={({ pressed }) => [styles.tab, pressed && styles.pressedTab]}>
            <FeedIcon color={C.textFaint} size={20} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              activeRouteName === 'index' && styles.activeTab,
              pressed && activeRouteName !== 'index' && styles.pressedTab,
            ]}
            onPress={() => goTo('index')}
          >
            <CompassIcon
              color={activeRouteName === 'index' ? C.primaryBright : C.textFaint}
              size={20}
              active={activeRouteName === 'index'}
            />
          </Pressable>
        </View>

        <View style={styles.fabSpacer} />

        <View style={styles.tabGroup}>
          <Pressable style={({ pressed }) => [styles.tab, pressed && styles.pressedTab]}>
            <SocialIcon color={C.textFaint} size={20} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              activeRouteName === 'profile' && styles.activeTab,
              pressed && activeRouteName !== 'profile' && styles.pressedTab,
            ]}
            onPress={() => goTo('profile')}
          >
            <PersonIcon
              color={activeRouteName === 'profile' ? C.primaryBright : C.textFaint}
              size={20}
              active={activeRouteName === 'profile'}
            />
          </Pressable>
        </View>

        <View style={styles.fabWrap} pointerEvents="box-none">
          <View style={styles.fabGlow} pointerEvents="none" />
          <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
            <PlusIcon color="#FFFFFF" size={26} />
          </Pressable>
        </View>
      </View>
      </View>
    </>
  );
}

export default function TabLayout() {
  const { colors: C } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Entdecken',
          tabBarIcon: ({ focused }) => (
            <CompassIcon color={focused ? C.primaryBright : C.textFaint} size={22} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <PersonIcon color={focused ? C.primaryBright : C.textFaint} size={22} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    // Fades content behind the floating nav bar.
    bottomFade: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: 130,
      zIndex: 50,
    },
    // Floating pill, hovering over screen content — no full-width background.
    wrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 100,
    },
    pill: {
      flexDirection:    'row',
      alignItems:       'center',
      height:           PILL_HEIGHT,
      backgroundColor:  C.surface,
      borderWidth:      1,
      borderColor:      C.border,
      borderRadius:     RADII.pill,
      paddingHorizontal: 8,
      ...ELEVATION.floating,
    },
    tabGroup: {
      flex:           1,
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-evenly',
    },
    tab: {
      width:           40,
      height:          40,
      alignItems:      'center',
      justifyContent:  'center',
      borderRadius:    RADII.md,
    },
    activeTab: {
      backgroundColor: C.primaryTint,
    },
    pressedTab: {
      backgroundColor: C.surface2,
    },
    // Reserves space in the pill's center for the floating + button.
    fabSpacer: {
      width: FAB_SIZE,
    },
    // The + button is larger than the pill and overlaps its top + bottom edges.
    fabWrap: {
      position: 'absolute',
      left:     '50%',
      marginLeft: -FAB_SIZE / 2,
      top:      (PILL_HEIGHT - FAB_SIZE) / 2,
      width:    FAB_SIZE,
      height:   FAB_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabGlow: {
      position:        'absolute',
      width:           FAB_SIZE,
      height:          FAB_SIZE,
      borderRadius:    FAB_SIZE / 2,
      backgroundColor: C.primary,
      shadowColor:     C.primary,
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.5,
      shadowRadius:    20,
      elevation:       0,
    },
    fab: {
      width:           FAB_SIZE,
      height:          FAB_SIZE,
      borderRadius:    FAB_SIZE / 2,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: C.primary,
      borderWidth:     1,
      borderColor:     C.primaryBright + '55',
      shadowColor:     C.primary,
      shadowOffset:    { width: 0, height: 3 },
      shadowOpacity:   0.35,
      shadowRadius:    8,
      elevation:       8,
    },
    fabPressed: {
      backgroundColor: C.primaryDeep,
    },
  });
}

import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CompassIcon, PersonIcon } from '@/components/icons';
import { FONTS, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 6 }]}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = (options.title ?? route.name) as string;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tab, focused && styles.activeTab]}
              activeOpacity={0.75}
            >
              {options.tabBarIcon?.({ focused, color: focused ? C.primary : C.textDim, size: 22 })}
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
            <CompassIcon color={focused ? C.primary : C.textDim} size={22} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <PersonIcon color={focused ? C.primary : C.textDim} size={22} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: C.bg,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    pill: {
      flexDirection: 'row',
      backgroundColor: C.surface2,
      borderRadius: 40,
      paddingVertical: 6,
      paddingHorizontal: 6,
      gap: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 34,
      gap: 3,
    },
    activeTab: {
      backgroundColor: C.primaryGlow,
    },
    tabLabel: {
      color: C.textDim,
      fontSize: 11,
      fontFamily: FONTS.semibold,
    },
    tabLabelActive: {
      color: C.primary,
    },
  });
}

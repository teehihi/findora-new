import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';

interface HeaderBarProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
  backgroundColor?: string;
  style?: any;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  showBack = false,
  onBackPress,
  rightAction,
  subtitle,
  backgroundColor,
  style,
}) => {
  const router = useRouter();

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null, style]}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={onBackPress || (() => router.back())}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});

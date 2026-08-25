import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SmartAppointmentPillProps {
  onPress: () => void;
}

export const SmartAppointmentPill: React.FC<SmartAppointmentPillProps> = ({ onPress }) => {
  return (
    <TouchableOpacity style={styles.pillContainer} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconCircle}>
        <Ionicons name="calendar" size={13} color="#FFFFFF" />
      </View>
      <Text style={styles.pillText}>Tạo nhắc hẹn từ tin nhắn này</Text>
      <Ionicons name="chevron-forward" size={14} color="#00A896" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00A896',
    marginRight: 4,
  },
});

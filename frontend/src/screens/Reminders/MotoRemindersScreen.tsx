import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/useAuthStore';
import { useReminderStore } from '@/store/useReminderStore';
import { ReminderType, VehicleReminder } from '@/services/api/reminderApi';
import { fetchUserProfile, MotorcycleData } from '@/services/api/userApi';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REMINDER_PRESETS: {
  type: ReminderType;
  title: string;
  shortLabel: string;
  defaultMonths: number;
  periodDesc: string;
}[] = [
  {
    type: 'TUVTURK_INSPECTION',
    title: 'TÜVTÜRK Inspection',
    shortLabel: 'TÜVTÜRK',
    defaultMonths: 24,
    periodDesc: '24 Months (2 Years)',
  },
  {
    type: 'TRAFFIC_INSURANCE',
    title: 'Traffic Insurance',
    shortLabel: 'INSURANCE',
    defaultMonths: 12,
    periodDesc: '12 Months (1 Year)',
  },
  {
    type: 'KASKO',
    title: 'Casco Policy',
    shortLabel: 'CASCO',
    defaultMonths: 12,
    periodDesc: '12 Months (1 Year)',
  },
  {
    type: 'CUSTOM',
    title: 'Periodic Service',
    shortLabel: 'SERVICE',
    defaultMonths: 1,
    periodDesc: 'Custom (1-12 Months)',
  },
];

const SERVICE_SUGGESTIONS = [
  { title: 'Chain Care & Lubrication', months: 1 },
  { title: 'Engine Oil & Filter Change', months: 3 },
  { title: 'Brake Inspection & Fluid', months: 6 },
  { title: 'Full Periodic Service', months: 6 },
  { title: 'Tire & Pressure Check', months: 1 },
];

const DURATION_CHIPS = [1, 2, 3, 4, 6, 12];

// Helper to format ISO YYYY-MM-DD -> DD/MM/YYYY
function formatDateDisplay(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
}

export function MotoRemindersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);

  const reminders = useReminderStore((s) => s.reminders);
  const loading = useReminderStore((s) => s.loading);
  const fetchReminders = useReminderStore((s) => s.fetchReminders);
  const addReminder = useReminderStore((s) => s.addReminder);
  const renewReminder = useReminderStore((s) => s.renewReminder);
  const removeReminder = useReminderStore((s) => s.removeReminder);

  const [motorcycles, setMotorcycles] = useState<MotorcycleData[]>([]);

  // Add Reminder Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReminderType>('TUVTURK_INSPECTION');
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);

  // Separate Day, Month, Year for clean DD/MM/YYYY input
  const today = new Date();
  const [dayInput, setDayInput] = useState(String(today.getDate()).padStart(2, '0'));
  const [monthInput, setMonthInput] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [yearInput, setYearInput] = useState(String(today.getFullYear()));

  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customMonthsInput, setCustomMonthsInput] = useState('24');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchReminders(token);
      fetchUserProfile(token)
        .then((data) => {
          setMotorcycles(data.motorcycles);
          const primary = data.motorcycles.find((b) => b.isPrimary) ?? data.motorcycles[0];
          if (primary) setSelectedBikeId(primary.id);
        })
        .catch(console.error);
    }
  }, [token]);

  const openCreateModal = () => {
    setSelectedType('TUVTURK_INSPECTION');
    setCustomMonthsInput('24');
    setCustomTitleInput('');
    const now = new Date();
    setDayInput(String(now.getDate()).padStart(2, '0'));
    setMonthInput(String(now.getMonth() + 1).padStart(2, '0'));
    setYearInput(String(now.getFullYear()));
    setNotesInput('');
    setIsAddModalOpen(true);
  };

  const handleSelectPresetType = (type: ReminderType) => {
    setSelectedType(type);
    const preset = REMINDER_PRESETS.find((p) => p.type === type);
    if (preset) {
      setCustomMonthsInput(String(preset.defaultMonths));
      setCustomTitleInput(type === 'CUSTOM' ? 'Chain Care & Lubrication' : preset.title);
    }
  };

  const handleApplyServiceSuggestion = (s: { title: string; months: number }) => {
    setCustomTitleInput(s.title);
    setCustomMonthsInput(String(s.months));
  };

  const handleSaveReminder = async () => {
    if (!token) return;
    const months = parseInt(customMonthsInput, 10);
    if (isNaN(months) || months <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid validity duration in months.');
      return;
    }

    const d = parseInt(dayInput, 10);
    const m = parseInt(monthInput, 10);
    const y = parseInt(yearInput, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) {
      Alert.alert('Invalid Date', 'Please enter a valid date in DD/MM/YYYY format.');
      return;
    }

    const isoDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    try {
      setIsSubmitting(true);
      const preset = REMINDER_PRESETS.find((p) => p.type === selectedType);
      const finalTitle = customTitleInput.trim() || preset?.title || 'Vehicle Reminder';

      await addReminder(token, {
        type: selectedType,
        motorcycleId: selectedBikeId,
        title: finalTitle,
        lastCompletedDate: isoDateStr,
        validityMonths: months,
        notes: notesInput.trim() || undefined,
      });

      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create reminder', err);
      Alert.alert('Error', 'Failed to save reminder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenew = (item: VehicleReminder) => {
    Alert.alert(
      'Renew Record',
      `Renew ${item.title} starting today? (+${item.validityMonths} Months will be added to expiration).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew Record',
          onPress: async () => {
            if (!token) return;
            try {
              const todayStr = new Date().toISOString().split('T')[0];
              await renewReminder(token, item.id, todayStr);
            } catch (err) {
              console.error('Failed to renew reminder', err);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item: VehicleReminder) => {
    Alert.alert('Delete Reminder', `Remove ${item.title} from active reminders?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await removeReminder(token, item.id);
          } catch (err) {
            console.error('Failed to delete reminder', err);
          }
        },
      },
    ]);
  };

  const getStatusVisuals = (status: VehicleReminder['status']) => {
    switch (status) {
      case 'EXPIRED':
        return {
          badgeColor: '#FF3B30',
          bgGlow: 'rgba(255,59,48,0.1)',
          borderColor: 'rgba(255,59,48,0.35)',
          tagText: 'EXPIRED',
        };
      case 'WARNING_1D':
        return {
          badgeColor: '#FF3B30',
          bgGlow: 'rgba(255,59,48,0.08)',
          borderColor: 'rgba(255,59,48,0.3)',
          tagText: 'LAST DAY',
        };
      case 'WARNING_3D':
        return {
          badgeColor: '#FF9500',
          bgGlow: 'rgba(255,149,0,0.08)',
          borderColor: 'rgba(255,149,0,0.3)',
          tagText: '3 DAYS LEFT',
        };
      case 'WARNING_7D':
        return {
          badgeColor: '#FFCC00',
          bgGlow: 'rgba(255,204,0,0.06)',
          borderColor: 'rgba(255,204,0,0.25)',
          tagText: '1 WEEK LEFT',
        };
      case 'WARNING_30D':
        return {
          badgeColor: '#FFD60A',
          bgGlow: 'rgba(255,214,10,0.05)',
          borderColor: 'rgba(255,214,10,0.2)',
          tagText: '1 MONTH LEFT',
        };
      default:
        return {
          badgeColor: colors.speedGreen,
          bgGlow: 'rgba(99,255,77,0.04)',
          borderColor: 'rgba(255,255,255,0.1)',
          tagText: 'VALID',
        };
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 50) }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Vehicle Reminders</Text>
          <Text style={styles.screenSubtitle}>INSPECTION & INSURANCE TRACKER</Text>
        </View>

        <Pressable style={styles.addBtnHeaderPill} onPress={openCreateModal} hitSlop={8}>
          <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
          <Text style={styles.addBtnHeaderText}>+ NEW</Text>
        </Pressable>
      </View>

      {loading && reminders.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.speedGreen} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* REGULATORY INFO BANNER */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>REGULATORY RENEWAL PERIODS</Text>
            <Text style={styles.infoBannerSub}>
              TÜVTÜRK Inspection: <Text style={{ color: '#fff', fontWeight: '600' }}>2 Years (24 Months)</Text> · Traffic Insurance: <Text style={{ color: '#fff', fontWeight: '600' }}>Annual (12 Months)</Text>
            </Text>
          </View>

          {/* REMINDERS LIST */}
          <View style={styles.remindersList}>
            {reminders.map((item) => {
              const visual = getStatusVisuals(item.status);
              const daysText =
                item.daysRemaining < 0
                  ? `${Math.abs(item.daysRemaining)} DAYS OVERDUE`
                  : item.daysRemaining === 0
                  ? 'EXPIRES TODAY'
                  : `${item.daysRemaining} DAYS REMAINING`;

              return (
                <View key={item.id} style={[styles.reminderCard, { borderColor: visual.borderColor }]}>
                  <BlurView intensity={24} tint="dark" style={styles.reminderBlur}>
                    <LinearGradient colors={[visual.bgGlow, 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFill} />

                    {/* Top Row: Type Tag & Status Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {item.type === 'TUVTURK_INSPECTION' ? 'TÜVTÜRK' :
                           item.type === 'TRAFFIC_INSURANCE' ? 'INSURANCE' :
                           item.type === 'KASKO' ? 'CASCO' : 'SERVICE'}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, { borderColor: visual.badgeColor }]}>
                        <Text style={[styles.statusBadgeText, { color: visual.badgeColor }]}>{visual.tagText}</Text>
                      </View>
                    </View>

                    {/* Title & Target Motorcycle */}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMotorcycle}>
                      {item.motorcycleName ? item.motorcycleName.toUpperCase() : 'GARAGE MOTORCYCLE'}
                    </Text>

                    {/* Countdown Box */}
                    <View style={styles.countdownBox}>
                      <Text style={[styles.countdownBigText, { color: visual.badgeColor }]}>{daysText}</Text>
                      <View style={styles.datesRow}>
                        <Text style={styles.dateLabel}>
                          LAST COMPLETED: <Text style={styles.dateVal}>{formatDateDisplay(item.lastCompletedDate)}</Text>
                        </Text>
                        <Text style={styles.dateLabel}>
                          EXPIRATION: <Text style={[styles.dateVal, { color: '#fff', fontWeight: '700' }]}>{formatDateDisplay(item.expiryDate)}</Text>
                        </Text>
                      </View>
                    </View>

                    {item.notes ? (
                      <Text style={styles.cardNotes}>{item.notes}</Text>
                    ) : null}

                    {/* Actions Row */}
                    <View style={styles.cardActionsRow}>
                      <Pressable style={styles.renewBtn} onPress={() => handleRenew(item)}>
                        <Text style={styles.renewBtnText}>RENEW RECORD ⟳</Text>
                      </Pressable>
                      <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                        <Text style={styles.deleteBtnText}>DELETE</Text>
                      </Pressable>
                    </View>
                  </BlurView>
                </View>
              );
            })}

            {reminders.length === 0 && (
              <View style={styles.emptyStateWrap}>
                <Text style={styles.emptyTitle}>NO ACTIVE REMINDERS</Text>
                <Text style={styles.emptySub}>
                  Keep your vehicle road-legal by tracking your TÜVTÜRK inspection, traffic insurance, and service intervals.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ADD REMINDER MODAL */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalBlurCard}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>NEW VEHICLE REMINDER</Text>
                <Text style={styles.modalSub}>Set automated inspection & insurance tracker</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsAddModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. SELECT TYPE PRESETS */}
              <Text style={styles.inputSectionLabel}>1. REMINDER TYPE</Text>
              <View style={styles.presetGrid}>
                {REMINDER_PRESETS.map((p) => {
                  const isSelected = selectedType === p.type;
                  return (
                    <Pressable
                      key={p.type}
                      style={[styles.presetCard, isSelected && styles.presetCardActive]}
                      onPress={() => handleSelectPresetType(p.type)}
                    >
                      <Text style={[styles.presetTitle, isSelected && { color: colors.speedGreen }]}>{p.title}</Text>
                      <Text style={styles.presetMonths}>{p.periodDesc}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* CUSTOM SERVICE TITLE & FREQUENCY (IF CUSTOM / SERVICE) */}
              {selectedType === 'CUSTOM' && (
                <View style={styles.customServiceConfigBox}>
                  <Text style={styles.inputSectionLabel}>SERVICE TITLE & PRESETS</Text>
                  
                  {/* Suggestions Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    {SERVICE_SUGGESTIONS.map((s) => (
                      <Pressable
                        key={s.title}
                        style={[styles.suggestionChip, customTitleInput === s.title && styles.suggestionChipActive]}
                        onPress={() => handleApplyServiceSuggestion(s)}
                      >
                        <Text style={[styles.suggestionChipText, customTitleInput === s.title && { color: colors.speedGreen }]}>
                          {s.title} ({s.months}M)
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Chain Maintenance, Oil Change..."
                    placeholderTextColor={colors.textTertiary}
                    value={customTitleInput}
                    onChangeText={setCustomTitleInput}
                  />

                  {/* Frequency Interval Chips */}
                  <Text style={[styles.inputSectionLabel, { marginTop: 12 }]}>INTERVAL FREQUENCY (MONTHS)</Text>
                  <View style={styles.durationChipsRow}>
                    {DURATION_CHIPS.map((mo) => {
                      const isMoSelected = customMonthsInput === String(mo);
                      return (
                        <Pressable
                          key={mo}
                          style={[styles.durationChip, isMoSelected && styles.durationChipActive]}
                          onPress={() => setCustomMonthsInput(String(mo))}
                        >
                          <Text style={[styles.durationChipText, isMoSelected && { color: '#04120a', fontWeight: '700' }]}>
                            {mo} {mo === 1 ? 'MONTH' : 'MONTHS'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Text style={styles.customMonthLabel}>CUSTOM INTERVAL:</Text>
                    <TextInput
                      style={styles.customMonthInput}
                      placeholder="Months"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={customMonthsInput}
                      onChangeText={setCustomMonthsInput}
                    />
                    <Text style={styles.customMonthLabel}>MONTHS</Text>
                  </View>
                </View>
              )}

              {/* 2. SELECT MOTORCYCLE */}
              {motorcycles.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.inputSectionLabel}>2. TARGET MOTORCYCLE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {motorcycles.map((m) => {
                      const isBikeSelected = selectedBikeId === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          style={[styles.bikePill, isBikeSelected && styles.bikePillActive]}
                          onPress={() => setSelectedBikeId(m.id)}
                        >
                          <Text style={[styles.bikePillText, isBikeSelected && { color: colors.speedGreen }]}>
                            {m.brand} {m.model}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 3. LAST COMPLETED DATE (DD / MM / YYYY) */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputSectionLabel}>3. LAST COMPLETED DATE (DD / MM / YYYY)</Text>
                <View style={styles.dateTripleRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.datePartInput}
                      placeholder="DD"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={dayInput}
                      onChangeText={setDayInput}
                    />
                    <Text style={styles.datePartLabel}>DAY</Text>
                  </View>

                  <Text style={styles.dateSlash}>/</Text>

                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.datePartInput}
                      placeholder="MM"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={monthInput}
                      onChangeText={setMonthInput}
                    />
                    <Text style={styles.datePartLabel}>MONTH</Text>
                  </View>

                  <Text style={styles.dateSlash}>/</Text>

                  <View style={{ flex: 1.4 }}>
                    <TextInput
                      style={styles.datePartInput}
                      placeholder="YYYY"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={4}
                      value={yearInput}
                      onChangeText={setYearInput}
                    />
                    <Text style={styles.datePartLabel}>YEAR</Text>
                  </View>
                </View>

                <Text style={styles.calculatedHelpText}>
                  Expiration will automatically be set to +{customMonthsInput} Months from this date.
                </Text>
              </View>

              {/* 4. NOTES */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputSectionLabel}>4. NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 44 }]}
                  placeholder="e.g. Station branch, policy number..."
                  placeholderTextColor={colors.textTertiary}
                  value={notesInput}
                  onChangeText={setNotesInput}
                />
              </View>
            </ScrollView>

            {/* MODAL ACTIONS */}
            <View style={styles.modalActionRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsAddModalOpen(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSaveReminder}
                disabled={isSubmitting}
              >
                <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                <Text style={styles.modalSubmitText}>
                  {isSubmitting ? 'SAVING...' : 'SAVE REMINDER'}
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0c0e12',
    gap: 12,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backIcon: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 22,
    color: '#fff',
    marginBottom: 2,
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    color: colors.speedGreen,
    marginTop: 2,
  },
  addBtnHeaderPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.speedGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnHeaderText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#04120a',
    letterSpacing: 0.8,
  },

  infoBanner: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen, letterSpacing: 1, marginBottom: 4 },
  infoBannerSub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.5)' },

  remindersList: { gap: 14 },
  reminderCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#101216',
  },
  reminderBlur: { padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: '#fff', letterSpacing: 0.8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusBadgeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, letterSpacing: 0.8 },

  cardTitle: { fontFamily: 'Archivo_800ExtraBold', fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  cardMotorcycle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 12 },

  countdownBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  countdownBigText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 17, letterSpacing: 0.5 },
  datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dateLabel: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  dateVal: { fontFamily: 'JetBrainsMono_500Medium', color: 'rgba(255,255,255,0.8)' },
  cardNotes: { fontFamily: 'Archivo_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },

  cardActionsRow: { flexDirection: 'row', gap: 8 },
  renewBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: colors.speedGreen, letterSpacing: 0.8 },
  deleteBtn: {
    width: 75,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8 },

  emptyStateWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  emptySub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBlurCard: {
    backgroundColor: '#12141a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontFamily: 'Archivo_700Bold', fontSize: 18, color: '#fff' },
  modalSub: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.speedGreen, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontSize: 12 },

  inputSectionLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 6 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
  },
  presetCardActive: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderColor: 'rgba(99,255,77,0.4)',
  },
  presetTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: '#fff' },
  presetMonths: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  bikePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  bikePillActive: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderColor: 'rgba(99,255,77,0.4)',
  },
  bikePillText: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  dateTripleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datePartInput: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 15,
    textAlign: 'center',
  },
  datePartLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4, letterSpacing: 0.8 },
  dateSlash: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: 'rgba(255,255,255,0.3)', marginBottom: 16 },

  modalInput: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
  },
  calculatedHelpText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: colors.speedGreen, marginTop: 6 },

  customServiceConfigBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  suggestionChipActive: {
    backgroundColor: 'rgba(99,255,77,0.15)',
    borderColor: 'rgba(99,255,77,0.4)',
  },
  suggestionChipText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  durationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  durationChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  durationChipActive: {
    backgroundColor: colors.speedGreen,
    borderColor: colors.speedGreen,
  },
  durationChipText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  customMonthLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
  },
  customMonthInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    color: '#fff',
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    textAlign: 'center',
  },

  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1, color: '#04120a' },
});

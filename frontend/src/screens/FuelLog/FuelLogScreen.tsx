import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createFuelLog,
  fetchFuelSummary,
  FuelLogRow,
  FuelStationPrice,
  FuelSummary,
  removeFuelLog,
} from '@/services/api/fuelApi';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

const STATION_COLORS: Record<string, string> = {
  Opet: '#005BBB',
  Shell: '#FFD100',
  'Petrol Ofisi': '#E30613',
  BP: '#007A3D',
  TotalEnergies: '#ED1C24',
  Aytemiz: '#E30613',
  Sunpet: '#FF9E1B',
};

export function FuelLogScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FuelSummary | null>(null);

  // New Fill-up Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<FuelStationPrice | null>(null);
  const [liters, setLiters] = useState('');
  const [customCost, setCustomCost] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await fetchFuelSummary(token);
      setSummary(data);
      if (data.livePrices && data.livePrices.length > 0 && !selectedStation) {
        setSelectedStation(data.livePrices[0]);
      }
    } catch (err) {
      console.warn('Failed to load fuel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Calculate live cost automatically based on selected brand price * liters
  const parsedLiters = parseFloat(liters) || 0;
  const currentPricePerLiter = selectedStation?.pricePerLiter || 44.95;
  const autoCalculatedCost = (parsedLiters * currentPricePerLiter).toFixed(2);
  const effectiveCost = customCost.trim() ? customCost : (parsedLiters > 0 ? autoCalculatedCost : '');

  const handleSelectStation = (station: FuelStationPrice) => {
    setSelectedStation(station);
    // If user hasn't typed custom cost override, recalculate with new station price
    if (parsedLiters > 0 && !customCost) {
      // automatically updates via effectiveCost
    }
  };

  const handleSaveFillUp = async () => {
    if (!token) return;
    const finalLiters = parseFloat(liters);
    const finalCost = parseFloat(effectiveCost);

    if (isNaN(finalLiters) || finalLiters <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid amount in liters.');
      return;
    }
    if (isNaN(finalCost) || finalCost <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid total cost.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createFuelLog(token, {
        liters: finalLiters,
        cost: finalCost,
        stationBrand: selectedStation?.brand || 'Opet',
        odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
      });

      const updated = await fetchFuelSummary(token);
      setSummary(updated);

      setLiters('');
      setCustomCost('');
      setOdometerKm('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create fuel log', err);
      Alert.alert('Error', 'Failed to save fuel entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = (logId: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this fuel record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await removeFuelLog(token, logId);
            setSummary((prev) => prev ? {
              ...prev,
              logs: prev.logs.filter((l) => l.id !== logId),
            } : null);
          } catch (err) {
            console.error('Failed to delete log', err);
          }
        },
      },
    ]);
  };

  const maxMonthlyCost = Math.max(1, ...(summary?.monthlyStats?.map((s) => s.totalCost) ?? [100]));

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 50) }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Fuel & Expenses</Text>
          <Text style={styles.screenSubtitle}>LIVE GAS TELEMETRY</Text>
        </View>

        <Pressable 
          style={styles.addBtnHeaderPill} 
          onPress={() => setIsModalOpen(true)} 
          hitSlop={8}
        >
          <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
          <Text style={styles.addBtnHeaderText}>+ ADD</Text>
        </Pressable>
      </View>

      {loading && !summary ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.speedGreen} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* LIVE FUEL PRICES TICKER / MARQUEE */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>CURRENT LIVE GAS PRICES</Text>
            <Text style={styles.sectionSubTitle}>95 OCTANE · TL/L</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pricesScroll}>
            {(summary?.livePrices ?? []).map((p) => {
              const isSelected = selectedStation?.brand === p.brand;
              return (
                <Pressable
                  key={p.brand}
                  style={[
                    styles.priceCard,
                    isSelected && { borderColor: colors.speedGreen, backgroundColor: 'rgba(99,255,77,0.1)' }
                  ]}
                  onPress={() => handleSelectStation(p)}
                >
                  <View style={styles.priceCardTop}>
                    <View style={[styles.brandDot, { backgroundColor: STATION_COLORS[p.brand] || colors.speedGreen }]} />
                    <Text style={styles.brandName}>{p.brand}</Text>
                  </View>
                  <Text style={styles.priceVal}>{p.pricePerLiter.toFixed(2)} <Text style={styles.priceUnit}>TL</Text></Text>
                  <Text style={styles.priceFuelType}>{p.fuelType}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* OVERVIEW METRICS (3-PILLAR CARDS) */}
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>THIS MONTH</Text>
              <Text style={styles.metricBigVal}>
                {summary?.currentMonthCost ?? 0} <Text style={styles.metricUnit}>TL</Text>
              </Text>
              <Text style={styles.metricSub}>{summary?.currentMonthFillUps ?? 0} FILL-UPS</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AVG CONSUMPTION</Text>
              <Text style={styles.metricBigVal}>
                {summary?.avgConsumptionL100Km ?? 4.8}
              </Text>
              <Text style={styles.metricSub}>L / 100 KM</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ALL TIME TOTAL</Text>
              <Text style={styles.metricBigVal}>
                {summary?.totalCostAllTime ?? 0} <Text style={styles.metricUnit}>TL</Text>
              </Text>
              <Text style={styles.metricSub}>{summary?.totalLitersAllTime ?? 0} LITERS</Text>
            </View>
          </View>

          {/* MONTHLY SPENDING BAR GRAPH */}
          <View style={styles.cardWrap}>
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>MONTHLY FUEL EXPENSES</Text>
                <Text style={styles.cardAction}>LAST 6 MONTHS</Text>
              </View>

              <View style={styles.graphWrap}>
                {(summary?.monthlyStats ?? []).map((stat, idx) => {
                  const heightPercent = Math.max(14, Math.min(100, Math.round((stat.totalCost / maxMonthlyCost) * 100)));
                  const isCurrentMonth = idx === (summary?.monthlyStats.length ?? 0) - 1;
                  return (
                    <View key={stat.month} style={styles.barCol}>
                      <Text style={styles.barCostLabel}>{stat.totalCost > 0 ? `${stat.totalCost}` : '-'}</Text>
                      <View 
                        style={[
                          styles.graphBar, 
                          { height: `${heightPercent}%` }, 
                          isCurrentMonth && { backgroundColor: 'transparent' }
                        ]}
                      >
                        {isCurrentMonth && (
                          <LinearGradient colors={['#7BFF5C', '#3FE22A']} style={StyleSheet.absoluteFill} />
                        )}
                      </View>
                      <Text style={[styles.graphMonthText, isCurrentMonth && { color: colors.speedGreen }]}>
                        {stat.month}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </BlurView>
          </View>

          {/* FILL-UP HISTORY LOG LIST */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>FILL-UP HISTORY</Text>
            <Text style={styles.sectionSubTitle}>{(summary?.logs ?? []).length} ENTRIES</Text>
          </View>

          {(summary?.logs ?? []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No fuel entries yet</Text>
              <Text style={styles.emptySub}>Tap "+ ADD" to record your first fill-up and calculate consumption.</Text>
            </View>
          ) : (
            (summary?.logs ?? []).map((log) => {
              const logDate = new Date(log.created_at);
              const dateStr = logDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
              const brandColor = STATION_COLORS[log.station_brand || 'Opet'] || colors.speedGreen;

              return (
                <View key={log.id} style={styles.logItemWrap}>
                  <BlurView intensity={24} tint="dark" style={styles.logItemBlur}>
                    <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                    
                    <View style={styles.logLeftCol}>
                      <View style={[styles.brandBadge, { backgroundColor: brandColor }]}>
                        <Text style={styles.brandBadgeText}>{(log.station_brand || 'GAS')[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.logStationName}>{log.station_brand || 'Gas Station'}</Text>
                        <Text style={styles.logDate}>{dateStr} {log.odometer_km ? `· ${log.odometer_km} km` : ''}</Text>
                      </View>
                    </View>

                    <View style={styles.logRightCol}>
                      <Text style={styles.logCost}>{log.cost} TL</Text>
                      <Text style={styles.logLiters}>{log.liters} L</Text>
                      <Pressable style={styles.deleteBtn} onPress={() => handleDeleteLog(log.id)} hitSlop={8}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </Pressable>
                    </View>

                  </BlurView>
                </View>
              );
            })
          )}

        </ScrollView>
      )}

      {/* SMART NEW FILL-UP MODAL WITH AUTOMATIC PRICE CALCULATION */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <BlurView intensity={45} tint="dark" style={styles.modalBlurCard}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>RECORD FILL-UP</Text>
                <Text style={styles.modalSub}>Select your gas station and enter liters</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* 1. Gas Station Brand Selector */}
            <Text style={styles.inputLabel}>1. SELECT FUEL STATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalStationScroll}>
              {(summary?.livePrices ?? []).map((station) => {
                const isSelected = selectedStation?.brand === station.brand;
                return (
                  <Pressable
                    key={station.brand}
                    style={[
                      styles.modalStationPill,
                      isSelected && { borderColor: colors.speedGreen, backgroundColor: 'rgba(99,255,77,0.18)' }
                    ]}
                    onPress={() => handleSelectStation(station)}
                  >
                    <View style={[styles.brandDotSmall, { backgroundColor: STATION_COLORS[station.brand] || colors.speedGreen }]} />
                    <Text style={[styles.modalStationName, isSelected && { color: colors.speedGreen, fontWeight: '700' }]}>
                      {station.brand}
                    </Text>
                    <Text style={styles.modalStationPrice}>{station.pricePerLiter.toFixed(2)} TL</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 2. Liters Input */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>2. FUEL AMOUNT (LITERS)</Text>
            <View style={styles.inputWrapRow}>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. 12.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={liters}
                onChangeText={setLiters}
              />
              <View style={styles.unitSuffix}>
                <Text style={styles.unitSuffixText}>LITERS</Text>
              </View>
            </View>

            {/* 3. Automatic Real-Time Price Calculation Banner */}
            {parsedLiters > 0 && (
              <View style={styles.autoCalcCard}>
                <View style={styles.autoCalcRow}>
                  <Text style={styles.autoCalcFormula}>
                    {parsedLiters} L × {currentPricePerLiter.toFixed(2)} TL/L
                  </Text>
                  <Text style={styles.autoCalcTotal}>{effectiveCost} TL</Text>
                </View>
                <Text style={styles.autoCalcHint}>
                  Calculated automatically based on live {selectedStation?.brand} pump rate
                </Text>
              </View>
            )}

            {/* 4. Total Cost Override / Odometer */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>TOTAL COST (TL)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Total Cost"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={effectiveCost}
                  onChangeText={setCustomCost}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>ODOMETER KM (OPT.)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. 14200"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={odometerKm}
                  onChangeText={setOdometerKm}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActionRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.6 }]} 
                onPress={handleSaveFillUp}
                disabled={isSubmitting}
              >
                <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                <Text style={styles.modalSubmitText}>
                  {isSubmitting ? 'SAVING...' : 'CONFIRM & SAVE'}
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 10 },

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

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2 },
  sectionSubTitle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.35)' },

  pricesScroll: { gap: 8, paddingVertical: 4 },
  priceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
    minWidth: 115,
  },
  priceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brandName: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#fff' },
  priceVal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: '#fff', marginTop: 2 },
  priceUnit: { fontSize: 10, color: colors.speedGreen },
  priceFuelType: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  metricGrid: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    alignItems: 'center',
  },
  metricLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 4 },
  metricBigVal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: '#fff' },
  metricUnit: { fontSize: 10, color: colors.speedGreen },
  metricSub: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: colors.speedGreen, letterSpacing: 0.5, marginTop: 4 },

  cardWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#111316',
    marginVertical: 10,
  },
  cardBlur: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)' },
  cardAction: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.35)' },

  graphWrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 95, paddingTop: 10 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  barCostLabel: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.35)' },
  graphBar: { width: 14, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  graphMonthText: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  logItemWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0e1014',
    marginBottom: 8,
  },
  logItemBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  logLeftCol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandBadgeText: { fontFamily: 'Archivo_700Bold', fontSize: 15, color: '#fff' },
  logStationName: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, color: '#fff' },
  logDate: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  logRightCol: { alignItems: 'flex-end', position: 'relative', paddingRight: 24 },
  logCost: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 15, color: colors.speedGreen },
  logLiters: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  deleteBtn: { position: 'absolute', right: 0, top: 4, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  emptyTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13, color: '#fff', marginBottom: 4 },
  emptySub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

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
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontFamily: 'Archivo_700Bold', fontSize: 18, color: '#fff' },
  modalSub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontSize: 12 },

  inputLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 6 },
  modalStationScroll: { gap: 8, paddingVertical: 4 },
  modalStationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  brandDotSmall: { width: 6, height: 6, borderRadius: 3 },
  modalStationName: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: '#fff' },
  modalStationPrice: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen },

  inputWrapRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  modalTextInput: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#ffffff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 14,
    width: '100%',
  },
  unitSuffix: { position: 'absolute', right: 14 },
  unitSuffixText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen, letterSpacing: 1 },

  autoCalcCard: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    borderRadius: 14,
    padding: 12,
    marginVertical: 12,
  },
  autoCalcRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  autoCalcFormula: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  autoCalcTotal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 20, color: colors.speedGreen },
  autoCalcHint: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  rowInputs: { flexDirection: 'row', gap: 10, marginTop: 4 },

  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1, color: '#04120a' },
});

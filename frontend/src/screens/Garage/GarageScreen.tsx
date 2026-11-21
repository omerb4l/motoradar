import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GarageMetricCards } from '@/components/garage/GarageMetricCards';
import { RootStackParamList } from '@/navigation/types';
import {
  fetchUserProfile,
  MotorcycleData,
  saveMotorcycle,
  updateUserProfile,
  UserProfileData,
} from '@/services/api/userApi';
import {
  createFuelLog,
  fetchFuelSummary,
  FuelSummary,
} from '@/services/api/fuelApi';
import { fetchAlbumPosts, AlbumPost } from '@/services/api/albumApi';
import { useReminderStore } from '@/store/useReminderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

const DEFAULT_ALBUM_IMAGES = [
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1590209795159-25ea1ff292f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1621345479029-7988880fcb12?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
];

export function GarageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const reminders = useReminderStore((s) => s.reminders);
  const fetchReminders = useReminderStore((s) => s.fetchReminders);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [motorcycles, setMotorcycles] = useState<MotorcycleData[]>([]);

  // Fuel Log States
  const [fuelSummary, setFuelSummary] = useState<FuelSummary | null>(null);
  const [isFuelModalVisible, setFuelModalVisible] = useState(false);
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdo, setFuelOdo] = useState('');
  const [isSavingFuel, setIsSavingFuel] = useState(false);

  // Album States
  const [albumPhotos, setAlbumPhotos] = useState<string[]>(DEFAULT_ALBUM_IMAGES);

  // Bio & Passion States
  const [isEditBioVisible, setEditBioVisible] = useState(false);
  const [bioText, setBioText] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Bio Modal Animated Controller (Synchronous Fade + Slide)
  const bioBackdropOpacity = useSharedValue(0);
  const bioSheetTranslateY = useSharedValue(450);

  const openBioModal = () => {
    setEditBioVisible(true);
    bioBackdropOpacity.value = withTiming(1, { duration: 250 });
    bioSheetTranslateY.value = withSpring(0, { damping: 18, stiffness: 140, mass: 0.8 });
  };

  const closeBioModal = () => {
    bioBackdropOpacity.value = withTiming(0, { duration: 200 });
    bioSheetTranslateY.value = withTiming(450, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setEditBioVisible)(false);
      }
    });
  };

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: bioBackdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bioSheetTranslateY.value }],
  }));

  const primaryBike = motorcycles.find((b) => b.isPrimary) ?? motorcycles[0];

  const handlePickHeroImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Please allow camera roll access to update your bike photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        if (primaryBike && token) {
          const updatedBike = await saveMotorcycle(token, { ...primaryBike, photoUrl: base64Uri });
          setMotorcycles((prev) => prev.map((b) => (b.id === updatedBike.id ? updatedBike : b)));
        } else {
          navigation.navigate('MotorcycleHistory');
        }
      }
    } catch (err) {
      console.warn('Failed to pick hero image:', err);
    }
  };

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [userData, fuelData, albumData] = await Promise.all([
        fetchUserProfile(token),
        fetchFuelSummary(token).catch((e) => {
          console.warn('Fuel summary fallback:', e);
          return null;
        }),
        fetchAlbumPosts(token).catch((e) => {
          console.warn('Album posts fallback:', e);
          return [] as AlbumPost[];
        }),
      ]);
      setProfile(userData.profile);
      setMotorcycles(userData.motorcycles);
      setBioText(userData.profile.bio || "Rider passionate about fast corners, scenic coastal roads, and weeknight group runs. Ride your own pace — see you at the summit.");
      if (fuelData) {
        setFuelSummary(fuelData);
      }
      if (albumData && albumData.length > 0) {
        setAlbumPhotos(albumData.map((p) => p.photo_url));
      }
      fetchReminders(token).catch((e) => console.warn('Reminders fallback:', e));
    } catch (err) {
      console.warn('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch automatically whenever returning to Garage screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [token])
  );

  const handleSaveFuelLog = async () => {
    if (!token) return;
    const litersNum = parseFloat(fuelLiters);
    const costNum = parseFloat(fuelCost);
    const odoNum = fuelOdo ? parseFloat(fuelOdo) : undefined;

    if (isNaN(litersNum) || litersNum <= 0 || isNaN(costNum) || costNum <= 0) {
      Alert.alert('Invalid Entry', 'Please enter valid liters and total cost.');
      return;
    }

    try {
      setIsSavingFuel(true);
      await createFuelLog(token, {
        liters: litersNum,
        cost: costNum,
        odometerKm: odoNum,
        motorcycleId: primaryBike?.id,
      });
      const updatedSummary = await fetchFuelSummary(token);
      setFuelSummary(updatedSummary);
      setFuelLiters('');
      setFuelCost('');
      setFuelOdo('');
      setFuelModalVisible(false);
    } catch (err) {
      console.error('Failed to save fuel log', err);
      Alert.alert('Error', 'Failed to save fuel log. Please try again.');
    } finally {
      setIsSavingFuel(false);
    }
  };

  const handleSaveBio = async () => {
    if (!token || !profile) return;
    try {
      setIsSavingBio(true);
      await updateUserProfile(token, { bio: bioText.trim() });
      setProfile({ ...profile, bio: bioText.trim() });
      closeBioModal();
    } catch (err) {
      console.error('Failed to update bio', err);
      Alert.alert('Error', 'Failed to save bio. Please try again.');
    } finally {
      setIsSavingBio(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.speedGreen} size="large" />
      </View>
    );
  }

  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const maxGraphCost = Math.max(1, ...(fuelSummary?.monthlyStats?.map((s) => s.totalCost) ?? [100]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        
        {/* Cinematic Header Image */}
        <Pressable style={styles.heroWrap} onPress={handlePickHeroImage}>
          <Image 
            source={{ uri: primaryBike?.photoUrl || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80' }} 
            style={{ width: '100%', height: '100%', position: 'absolute' }} 
            resizeMode="cover" 
          />
          <LinearGradient 
            colors={['transparent', '#08080a']} 
            locations={[0.4, 1]} 
            style={StyleSheet.absoluteFill} 
          />
          <View style={styles.headerTop}>
            <Text style={styles.logoText}>GARAGE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
                <Text style={styles.settingsIcon}>⋯</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.uploadPromptWrap}>
            <Text style={styles.uploadPromptText}>{primaryBike?.photoUrl ? 'TAP TO CHANGE PHOTO' : 'TAP TO UPLOAD PHOTO'}</Text>
          </View>
        </Pressable>

        <View style={styles.detailsWrap}>
          <View style={styles.vinBadge}>
            <Text style={styles.vinText}>
              {primaryBike ? `${primaryBike.brand} LINKED ✓` : 'NO BIKE LINKED'}
            </Text>
          </View>
          
          <Text style={styles.bikeTitle}>
            {primaryBike ? `${primaryBike.brand} ${primaryBike.model}`.toUpperCase() : 'NO MOTORCYCLE LINKED'}
          </Text>
          <Text style={styles.bikeSubtitle}>
            {primaryBike ? `${primaryBike.displacementCc ?? 125} cc · ${primaryBike.modelYear ?? 2024} · ${primaryBike.odometerKm ?? 0} KM` : 'Tap MOTORCYCLE HISTORY below to link your bike'}
          </Text>

          {/* Dynamic Metric Cards */}
          <View style={styles.cards}>
            <GarageMetricCards
              topSpeed={primaryBike?.topSpeed ?? 285}
              topSpeedUnit={primaryBike?.topSpeedUnit ?? 'km/h'}
              topSpeedContext={primaryBike?.topSpeedContext ?? 'TRACK RECORD'}
              maxLeanDeg={primaryBike?.maxLeanDeg ?? 52}
              maxLeanSide={primaryBike?.maxLeanSide ?? 'LEFT'}
              maxLeanContext={primaryBike?.maxLeanContext ?? 'CANYON RUN'}
              onPress={() => navigation.navigate('RideSummary')}
            />
          </View>

          {/* 1. RIDER BIO & PASSION */}
          <View style={[styles.cardWrap, { marginTop: 14 }]}>
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>RIDER BIO & PASSION</Text>
                <Pressable onPress={openBioModal} hitSlop={10}>
                  <Text style={[styles.cardAction, { color: colors.speedGreen }]}>EDIT ✎</Text>
                </Pressable>
              </View>
              <Text style={styles.bioText}>{bioText}</Text>
            </BlurView>
          </View>

          {/* 2. LIVE DYNAMIC FUEL LOG */}
          <Pressable 
            style={[styles.cardWrap, { marginTop: 14 }]} 
            onPress={() => navigation.navigate('FuelLog')}
          >
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>FUEL LOG · {currentMonthName}</Text>
                  <Text style={{ fontSize: 10, color: colors.speedGreen }}>↗</Text>
                </View>
                <Text style={[styles.cardAction, { color: colors.speedGreen }]}>DETAILS →</Text>
              </View>

              <View style={styles.fuelStatsRow}>
                <View>
                  <Text style={styles.fuelBigVal}>
                    {fuelSummary?.currentMonthCost ?? 0} <Text style={{ fontSize: 13, color: colors.speedGreen }}>TL</Text>
                  </Text>
                  <Text style={styles.fuelSubVal}>
                    {fuelSummary?.currentMonthFillUps ?? 0} FILL-UPS
                  </Text>
                </View>
                <View style={styles.fuelDivider} />
                <View>
                  <Text style={styles.fuelBigVal}>
                    {fuelSummary?.avgConsumptionL100Km ?? 4.8}
                    <Text style={styles.fuelUnit}> L/100km</Text>
                  </Text>
                  <Text style={styles.fuelSubVal}>AVG CONSUMPTION</Text>
                </View>
              </View>

              {/* Dynamic 6-Month Bar Graph */}
              <View style={styles.graphWrap}>
                {fuelSummary?.monthlyStats && fuelSummary.monthlyStats.length > 0 ? (
                  fuelSummary.monthlyStats.map((stat, idx) => {
                    const heightPercent = Math.max(12, Math.min(100, Math.round((stat.totalCost / maxGraphCost) * 100)));
                    const isLast = idx === fuelSummary.monthlyStats.length - 1;
                    return (
                      <View 
                        key={stat.month} 
                        style={[
                          styles.graphBar, 
                          { height: `${heightPercent}%` }, 
                          isLast && { backgroundColor: 'transparent' }
                        ]}
                      >
                        {isLast && (
                          <LinearGradient colors={['#7BFF5C', '#3FE22A']} style={StyleSheet.absoluteFill} />
                        )}
                      </View>
                    );
                  })
                ) : (
                  <>
                    <View style={[styles.graphBar, { height: '35%' }]} />
                    <View style={[styles.graphBar, { height: '55%' }]} />
                    <View style={[styles.graphBar, { height: '40%' }]} />
                    <View style={[styles.graphBar, { height: '70%' }]} />
                    <View style={[styles.graphBar, { height: '50%' }]} />
                    <View style={[styles.graphBar, { height: '100%', backgroundColor: 'transparent' }]}>
                      <LinearGradient colors={['#7BFF5C', '#3FE22A']} style={StyleSheet.absoluteFill} />
                    </View>
                  </>
                )}
              </View>

              <View style={styles.graphLabels}>
                {fuelSummary?.monthlyStats && fuelSummary.monthlyStats.length > 0 ? (
                  fuelSummary.monthlyStats.map((stat) => (
                    <Text key={stat.month} style={styles.graphLabel}>{stat.month}</Text>
                  ))
                ) : (
                  ['FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'].map((m) => (
                    <Text key={m} style={styles.graphLabel}>{m}</Text>
                  ))
                )}
              </View>
            </BlurView>
          </Pressable>

          {/* 3. MOTO REMINDERS */}
          <Pressable 
            style={[styles.cardWrap, { marginTop: 14 }]} 
            onPress={() => navigation.navigate('MotoReminders')}
          >
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>VEHICLE REMINDERS · {reminders.length}</Text>
                  <Text style={{ fontSize: 10, color: colors.speedGreen }}>↗</Text>
                </View>
                <Text style={[styles.cardAction, { color: colors.speedGreen }]}>MANAGE →</Text>
              </View>

              {reminders.length > 0 ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {reminders.slice(0, 3).map((r) => {
                    const isUrgent = r.status !== 'SAFE';
                    const daysText = r.daysRemaining < 0 
                      ? `${Math.abs(r.daysRemaining)}D OVERDUE` 
                      : r.daysRemaining === 0
                      ? 'EXPIRES TODAY'
                      : `${r.daysRemaining}D LEFT`;

                    const dateParts = r.expiryDate.split('-');
                    const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : r.expiryDate;

                    return (
                      <View key={r.id} style={styles.reminderMiniRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={styles.miniTypePill}>
                            <Text style={styles.miniTypePillText}>
                              {r.type === 'TUVTURK_INSPECTION' ? 'TÜVTÜRK' :
                               r.type === 'TRAFFIC_INSURANCE' ? 'INSURANCE' :
                               r.type === 'KASKO' ? 'CASCO' : 'SERVICE'}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.reminderMiniTitle}>{r.title}</Text>
                            <Text style={styles.reminderMiniDate}>Expires: {dateFormatted}</Text>
                          </View>
                        </View>
                        <View style={[styles.reminderMiniBadge, isUrgent && styles.reminderMiniBadgeUrgent]}>
                          <Text style={[styles.reminderMiniBadgeText, isUrgent && { color: '#FF4D4D' }]}>
                            {daysText}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.reminderEmptyWrap}>
                  <Text style={styles.reminderEmptyTitle}>NO ACTIVE REMINDERS</Text>
                  <Text style={styles.reminderEmptySub}>Track TÜVTÜRK inspection (24 Mo) and traffic insurance (12 Mo)</Text>
                </View>
              )}
            </BlurView>
          </Pressable>

          {/* 4. MOTO ALBUM */}
          <Pressable 
            style={[styles.cardWrap, { marginTop: 14 }]} 
            onPress={() => navigation.navigate('MotoAlbum')}
          >
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>MOTO ALBUM · {albumPhotos.length}</Text>
                  <Text style={{ fontSize: 10, color: colors.speedGreen }}>↗</Text>
                </View>
                <Text style={[styles.cardAction, { color: colors.speedGreen }]}>FEED →</Text>
              </View>
              
              <View style={styles.albumGrid}>
                {/* Hero Shot (Left) */}
                <View style={styles.albumHero}>
                  <Image source={{ uri: albumPhotos[0] || DEFAULT_ALBUM_IMAGES[0] }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                  <Text style={styles.albumHeroLabel}>[ HERO SHOT ]</Text>
                </View>
                
                {/* Right Side Grid (2x2) */}
                <View style={styles.albumRightCol}>
                  <View style={styles.albumRow}>
                    <View style={styles.albumSmallImg}>
                      <Image source={{ uri: albumPhotos[1] || DEFAULT_ALBUM_IMAGES[1] }} style={{ width: '100%', height: '100%' }} />
                    </View>
                    <View style={styles.albumSmallImgPlay}>
                      <Image source={{ uri: albumPhotos[2] || DEFAULT_ALBUM_IMAGES[2] }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                      <View style={styles.playIconOutline}>
                        <View style={styles.playIconTriangle} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.albumRow}>
                    <View style={styles.albumSmallImg}>
                      <Image source={{ uri: albumPhotos[3] || DEFAULT_ALBUM_IMAGES[3] }} style={{ width: '100%', height: '100%' }} />
                    </View>
                    <View style={styles.albumMoreWrap}>
                      <Text style={styles.albumMoreText}>+ OPEN</Text>
                    </View>
                  </View>
                </View>
              </View>
            </BlurView>
          </Pressable>

          {/* 4. MOTORCYCLE HISTORY */}
          <Pressable 
            style={[styles.cardWrap, { marginTop: 14 }]} 
            onPress={() => navigation.navigate('MotorcycleHistory')}
          >
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>MOTORCYCLE HISTORY · {motorcycles.length}</Text>
                  <Text style={{ fontSize: 10, color: colors.speedGreen }}>↗</Text>
                </View>
                <Text style={[styles.cardAction, { color: colors.speedGreen }]}>DETAILS →</Text>
              </View>
              
              <View style={styles.historyList}>
                <LinearGradient 
                  colors={['#63FF4D', 'rgba(255,255,255,0.14)']} 
                  style={styles.historyTimelineLine} 
                />
                
                {motorcycles.length > 0 ? (
                  motorcycles.slice(0, 4).map((bike, idx) => {
                    const isBikePrimary = bike.isPrimary;
                    const dateSub = isBikePrimary 
                      ? `${bike.modelYear || '2024'} — PRESENT · PRIMARY`
                      : `${bike.ownershipStartDate || ''} — ${bike.ownershipEndDate || ''} · ${bike.odometerKm || bike.odometerMi || 0} KM`;

                    return (
                      <View key={bike.id || idx} style={[styles.historyItem, idx === motorcycles.length - 1 && styles.historyItemLast]}>
                        <View style={isBikePrimary ? styles.historyDotPrimary : styles.historyDotDim} />
                        <Text style={isBikePrimary ? styles.historyName : styles.historyNameDim}>
                          {`${bike.brand} ${bike.model}`}
                        </Text>
                        <Text style={isBikePrimary ? styles.historySubPrimary : styles.historySubDim}>
                          {dateSub}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.historyItem}>
                    <View style={styles.historyDotPrimary} />
                    <Text style={styles.historyName}>No motorcycle linked</Text>
                    <Text style={styles.historySubPrimary}>Tap to link your first ride</Text>
                  </View>
                )}
              </View>
            </BlurView>
          </Pressable>

          {/* LOG OUT BUTTON */}
          <View style={{ marginTop: 16 }}>
            <Pressable style={[styles.actionBtn, styles.logoutBtn, { width: '100%' }]} onPress={logout}>
              <Text style={styles.logoutText}>LOG OUT</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* EDIT BIO MODAL (Synchronized Fade & Slide Above Navbar) */}
      <Modal visible={isEditBioVisible} transparent animationType="none" statusBarTranslucent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={StyleSheet.absoluteFill} 
          pointerEvents="box-none"
        >
          {/* Animated Smooth Darkening Backdrop */}
          <Animated.View style={[styles.modalOverlayAnimated, animatedBackdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeBioModal} />
          </Animated.View>

          {/* Animated Smooth Sliding Bottom Sheet */}
          <Animated.View style={[styles.modalSheetContainer, animatedSheetStyle]}>
            <View style={styles.modalBlurCard}>
              <LinearGradient 
                colors={['#161920', '#0e1014']} 
                style={StyleSheet.absoluteFill} 
              />

              {/* Modal Drag Handle */}
              <View style={styles.modalDragHandle} />

              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>RIDER BIO & PASSION</Text>
                  <Text style={styles.modalSub}>Write about your riding passion & routes.</Text>
                </View>
                <Pressable style={styles.modalCloseBtn} onPress={closeBioModal} hitSlop={10}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              <TextInput 
                style={styles.bioTextInput} 
                placeholder="Write about your riding journey, bike setup, canyon pace..." 
                placeholderTextColor="rgba(255,255,255,0.3)" 
                multiline 
                value={bioText} 
                onChangeText={setBioText} 
              />

              <View style={styles.modalActionRow}>
                <Pressable style={styles.modalCancelBtn} onPress={closeBioModal}>
                  <Text style={styles.modalCancelText}>CANCEL</Text>
                </Pressable>
                <Pressable 
                  style={[styles.modalSubmitBtn, isSavingBio && { opacity: 0.6 }]} 
                  onPress={handleSaveBio}
                  disabled={isSavingBio}
                >
                  <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                  <Text style={styles.modalSubmitText}>
                    {isSavingBio ? 'SAVING...' : 'SAVE BIO ✓'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADD FUEL LOG MODAL */}
      <Modal visible={isFuelModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>NEW FUEL LOG</Text>
            <Text style={styles.modalSubTitle}>Record your fill-up to calculate average consumption.</Text>
            
            <TextInput 
              style={styles.modalInput} 
              placeholder="Liters (e.g. 12.5)" 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="decimal-pad" 
              value={fuelLiters} 
              onChangeText={setFuelLiters} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Total Cost $ (e.g. 520)" 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="decimal-pad" 
              value={fuelCost} 
              onChangeText={setFuelCost} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Current Odometer KM (Optional)" 
              placeholderTextColor={colors.textTertiary} 
              keyboardType="numeric" 
              value={fuelOdo} 
              onChangeText={setFuelOdo} 
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setFuelModalVisible(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
              <Pressable 
                style={[styles.saveBtn, isSavingFuel && { opacity: 0.6 }]} 
                onPress={handleSaveFuelLog}
                disabled={isSavingFuel}
              >
                <Text style={styles.saveText}>{isSavingFuel ? 'SAVING...' : 'SAVE LOG'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, backgroundColor: '#08080a', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#08080a' },
  content: { paddingBottom: 140 },
  heroWrap: { width: '100%', height: 380, position: 'relative' },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  logoText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: '#ffffff',
  },
  settingsIcon: { fontSize: 24, color: 'rgba(255,255,255,0.7)', marginTop: -6 },
  uploadPromptWrap: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  uploadPromptText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  detailsWrap: { paddingHorizontal: 20, marginTop: -20 },
  vinBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99,255,77,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    marginBottom: 8,
  },
  vinText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.speedGreen,
  },
  bikeTitle: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 28,
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  bikeSubtitle: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 12,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  cards: { marginTop: 24 },

  cardWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#111316',
  },
  cardBlur: { padding: 16 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.5)',
  },
  cardAction: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    color: colors.speedGreen,
  },
  bioText: {
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
  },

  // Fuel stats inside card
  fuelStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  fuelBigVal: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 22,
    color: '#ffffff',
  },
  fuelUnit: { fontSize: 13, color: colors.speedGreen },
  fuelSubVal: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  fuelDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
  },

  graphWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
  },
  graphBar: {
    width: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  graphLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  graphLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.4)',
  },

  // Album Grid
  albumGrid: { flexDirection: 'row', gap: 8, height: 180 },
  albumHero: {
    flex: 1.2,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#16191f',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  albumHeroLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  albumRightCol: { flex: 1, gap: 8 },
  albumRow: { flex: 1, flexDirection: 'row', gap: 8 },
  albumSmallImg: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#16191f',
  },
  albumSmallImgPlay: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#16191f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconOutline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playIconTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 0,
    borderBottomWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: '#ffffff',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 2,
  },
  albumMoreWrap: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumMoreText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
    letterSpacing: 0.8,
  },

  // History Timeline
  historyList: { marginTop: 8, position: 'relative', paddingLeft: 20 },
  historyTimelineLine: { position: 'absolute', left: 4, top: 8, bottom: 8, width: 2 },
  historyItem: { marginBottom: 16 },
  historyItemLast: { marginBottom: 0 },
  historyDotPrimary: {
    position: 'absolute',
    left: -20,
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.speedGreen,
  },
  historyDotDim: {
    position: 'absolute',
    left: -19,
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  historyName: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13, color: '#ffffff' },
  historySubPrimary: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.speedGreen,
    marginTop: 2,
  },
  historyNameDim: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  historySubDim: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },

  actionBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
  },

  // Reminder mini card styles
  reminderMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  miniTypePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniTypePillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  reminderMiniTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#fff' },
  reminderMiniDate: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  reminderMiniBadge: {
    backgroundColor: 'rgba(99,255,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reminderMiniBadgeUrgent: {
    backgroundColor: 'rgba(255,45,70,0.15)',
    borderColor: 'rgba(255,45,70,0.4)',
  },
  reminderMiniBadgeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, color: colors.speedGreen, letterSpacing: 0.5 },

  reminderEmptyWrap: { paddingVertical: 12, alignItems: 'center' },
  reminderEmptyTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#fff' },
  reminderEmptySub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  // MODAL STYLES
  modalOverlayAnimated: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modalSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'flex-end' 
  },
  modalBlurCard: {
    backgroundColor: '#12141a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 18, 
    color: '#fff',
    letterSpacing: -0.2,
  },
  modalSub: { 
    fontFamily: 'JetBrainsMono_500Medium', 
    fontSize: 10, 
    color: colors.speedGreen, 
    marginTop: 2,
    letterSpacing: 0.5,
  },
  modalCloseBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  modalCloseText: { 
    color: '#fff', 
    fontSize: 13,
    fontWeight: '600',
  },

  bioTextInput: {
    height: 110,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },

  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1, color: '#04120a' },

  // Simple modal content fallback
  modalContent: {
    backgroundColor: '#16191f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalSubTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.speedGreen,
  },
  saveText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    letterSpacing: 1,
    color: '#08080a',
  },
});

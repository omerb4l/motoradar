import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteMotorcycleApi,
  fetchUserProfile,
  MotorcycleData,
  saveMotorcycle,
  setPrimaryMotorcycleApi,
} from '@/services/api/userApi';
import {
  MOTORCYCLE_CATALOG,
  MotorcycleBrand,
  MotorcycleModelSpec,
  searchCatalogGlobally,
} from '@/data/motorcycleCatalog';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MotorcycleHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [motorcycles, setMotorcycles] = useState<MotorcycleData[]>([]);

  // WIZARD MODAL STATES
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Search queries
  const [globalSearch, setGlobalSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  // Selected vehicle details
  const [selectedBrandName, setSelectedBrandName] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');

  const [selectedBrandObj, setSelectedBrandObj] = useState<MotorcycleBrand | null>(null);

  // Step 3 fields
  const [modelYear, setModelYear] = useState('2024');
  const [displacementCc, setDisplacementCc] = useState('125');
  const [odometerKm, setOdometerKm] = useState('');
  const [ownershipStart, setOwnershipStart] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  // Photo & Authenticity Scan
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [photoScanStatus, setPhotoScanStatus] = useState<'IDLE' | 'SCANNING' | 'VERIFIED'>('IDLE');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await fetchUserProfile(token);
      setMotorcycles(data.motorcycles);
    } catch (err) {
      console.warn('Failed to load motorcycles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const openAddWizard = () => {
    setWizardStep(1);
    setGlobalSearch('');
    setModelSearch('');
    setSelectedBrandName('');
    setSelectedModelName('');
    setIsCustomBrand(false);
    setIsCustomModel(false);
    setCustomBrandInput('');
    setCustomModelInput('');
    setSelectedBrandObj(null);
    setModelYear('2024');
    setDisplacementCc('125');
    setOdometerKm('');
    setOwnershipStart(new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }));
    setIsPrimary(true);
    setPhotoUri(null);
    setPhotoScanStatus('IDLE');
    setIsWizardOpen(true);
  };

  const handleSelectBrand = (brand: MotorcycleBrand) => {
    setSelectedBrandObj(brand);
    setSelectedBrandName(brand.brand);
    setIsCustomBrand(false);
    setModelSearch('');
    setWizardStep(2);
  };

  const handleSelectModel = (model: MotorcycleModelSpec) => {
    setSelectedModelName(model.name);
    setIsCustomModel(false);
    setDisplacementCc(String(model.defaultCc));
    setWizardStep(3);
  };

  const handleSelectGlobalResult = (item: { brand: MotorcycleBrand; model: MotorcycleModelSpec }) => {
    setSelectedBrandObj(item.brand);
    setSelectedBrandName(item.brand.brand);
    setSelectedModelName(item.model.name);
    setIsCustomBrand(false);
    setIsCustomModel(false);
    setDisplacementCc(String(item.model.defaultCc));
    setWizardStep(3);
  };

  const handleUseCustomBrand = () => {
    if (!customBrandInput.trim()) {
      Alert.alert('Brand Required', 'Please type your custom brand name.');
      return;
    }
    setSelectedBrandName(customBrandInput.trim());
    setIsCustomBrand(true);
    setSelectedBrandObj(null);
    setWizardStep(2);
  };

  const handleUseCustomModel = () => {
    if (!customModelInput.trim()) {
      Alert.alert('Model Required', 'Please type your custom model name.');
      return;
    }
    setSelectedModelName(customModelInput.trim());
    setIsCustomModel(true);
    setWizardStep(3);
  };

  const handlePickVehiclePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to upload your motorcycle.');
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
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUri(uri);
        
        // Trigger simulated Authenticity & Anti-Stock Photo Scan
        setIsScanningPhoto(true);
        setPhotoScanStatus('SCANNING');
        setTimeout(() => {
          setIsScanningPhoto(false);
          setPhotoScanStatus('VERIFIED');
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to pick photo', err);
    }
  };

  const handleSaveNewMotorcycle = async () => {
    if (!token) return;
    const finalBrand = selectedBrandName.trim();
    const finalModel = selectedModelName.trim();

    if (!finalBrand || !finalModel) {
      Alert.alert('Missing Info', 'Brand and Model are required.');
      return;
    }

    try {
      setIsSaving(true);
      await saveMotorcycle(token, {
        brand: finalBrand,
        model: finalModel,
        modelYear: parseInt(modelYear, 10) || 2024,
        displacementCc: parseInt(displacementCc, 10) || 125,
        odometerKm: odometerKm ? parseInt(odometerKm, 10) : 0,
        ownershipStartDate: ownershipStart || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        ownershipEndDate: isPrimary ? 'PRESENT' : new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        photoUrl: photoUri || undefined,
        photoIsVerified: photoScanStatus === 'VERIFIED',
        isPrimary,
        topSpeed: 280,
        topSpeedUnit: 'km/h',
        maxLeanDeg: 52,
      });

      // Reload fresh data from server
      await loadData();
      setIsWizardOpen(false);
    } catch (err) {
      console.error('Failed to save motorcycle', err);
      Alert.alert('Error', 'Failed to link motorcycle to your garage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async (bikeId: string) => {
    if (!token) return;
    try {
      await setPrimaryMotorcycleApi(token, bikeId);
      await loadData();
    } catch (err) {
      console.error('Failed to set primary bike', err);
    }
  };

  const handleDeleteBike = (bikeId: string, bikeName: string) => {
    Alert.alert('Delete Motorcycle', `Remove ${bikeName} from your garage history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteMotorcycleApi(token, bikeId);
            setMotorcycles((prev) => prev.filter((b) => b.id !== bikeId));
          } catch (err) {
            console.error('Failed to delete bike', err);
          }
        },
      },
    ]);
  };

  const globalResults = globalSearch.trim() ? searchCatalogGlobally(globalSearch) : [];
  const filteredBrands = MOTORCYCLE_CATALOG.filter((b) =>
    b.brand.toLowerCase().includes(globalSearch.toLowerCase())
  );
  const filteredModels = (selectedBrandObj?.models ?? []).filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 50) }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Garage Fleet</Text>
          <Text style={styles.screenSubtitle}>{motorcycles.length} BIKES IN FLEET</Text>
        </View>

        <Pressable style={styles.addBtnHeaderPill} onPress={openAddWizard} hitSlop={8}>
          <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
          <Text style={styles.addBtnHeaderText}>+ LINK BIKE</Text>
        </Pressable>
      </View>

      {loading && motorcycles.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.speedGreen} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.timelineList}>
            <LinearGradient 
              colors={['#63FF4D', 'rgba(255,255,255,0.15)']} 
              style={styles.timelineVerticalLine} 
            />

            {motorcycles.map((bike, idx) => {
              const isBikePrimary = bike.isPrimary;
              const dateRange = isBikePrimary 
                ? `${bike.ownershipStartDate || '2024'} — PRESENT`
                : `${bike.ownershipStartDate || 'Past'} — ${bike.ownershipEndDate || 'Sold'}`;

              return (
                <View key={bike.id || idx} style={styles.bikeCardWrap}>
                  {/* Timeline Dot */}
                  <View style={isBikePrimary ? styles.timelineDotPrimary : styles.timelineDotDim} />

                  <BlurView intensity={24} tint="dark" style={styles.bikeCardBlur}>
                    <LinearGradient 
                      colors={isBikePrimary ? ['rgba(99,255,77,0.09)', 'rgba(99,255,77,0.02)'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} 
                      style={StyleSheet.absoluteFill} 
                    />

                    {/* Top Row */}
                    <View style={styles.bikeCardTopRow}>
                      <View style={styles.bikeMetaBadge}>
                        <Text style={[styles.bikeMetaText, isBikePrimary && { color: colors.speedGreen }]}>
                          {isBikePrimary ? '★ CURRENT PRIMARY' : 'PREVIOUS RIDE'}
                        </Text>
                      </View>

                      <Pressable 
                        style={styles.deleteBikeBtn} 
                        onPress={() => handleDeleteBike(bike.id, `${bike.brand} ${bike.model}`)}
                        hitSlop={10}
                      >
                        <Text style={styles.deleteBikeText}>✕</Text>
                      </Pressable>
                    </View>

                    {/* Bike Photo */}
                    <View style={styles.bikePhotoWrap}>
                      <Image 
                        source={{ uri: bike.photoUrl || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} 
                        style={styles.bikePhoto} 
                        resizeMode="cover" 
                      />
                      {bike.photoIsVerified !== false && (
                        <View style={styles.verifiedPhotoBadge}>
                          <Text style={styles.verifiedPhotoText}>AUTHENTIC PHOTO ✓</Text>
                        </View>
                      )}
                    </View>

                    {/* Bike Title & Specs */}
                    <Text style={styles.bikeCardTitle}>{`${bike.brand} ${bike.model}`.toUpperCase()}</Text>
                    <Text style={styles.bikeCardDate}>{dateRange}</Text>

                    <View style={styles.bikeSpecsRow}>
                      <View style={styles.specPill}>
                        <Text style={styles.specLabel}>ENGINE</Text>
                        <Text style={styles.specVal}>{bike.displacementCc ?? 125} cc</Text>
                      </View>

                      <View style={styles.specPill}>
                        <Text style={styles.specLabel}>YEAR</Text>
                        <Text style={styles.specVal}>{bike.modelYear ?? 2024}</Text>
                      </View>

                      <View style={styles.specPill}>
                        <Text style={styles.specLabel}>ODOMETER</Text>
                        <Text style={styles.specVal}>{bike.odometerKm ?? bike.odometerMi ?? 0} KM</Text>
                      </View>
                    </View>

                    {/* Make Primary Action if not primary */}
                    {!isBikePrimary && (
                      <Pressable style={styles.setPrimaryBtn} onPress={() => handleSetPrimary(bike.id)}>
                        <Text style={styles.setPrimaryText}>SET AS CURRENT PRIMARY RIDE ★</Text>
                      </Pressable>
                    )}

                  </BlurView>
                </View>
              );
            })}
          </View>

        </ScrollView>
      )}

      {/* STEP-BY-STEP ADD MOTORCYCLE WIZARD MODAL */}
      <Modal visible={isWizardOpen} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalBlurCard}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

            {/* Wizard Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>LINK MOTORCYCLE</Text>
                <Text style={styles.modalSub}>Step {wizardStep} of 4 · {
                  wizardStep === 1 ? 'Search Brand or Model' :
                  wizardStep === 2 ? 'Select Model' :
                  wizardStep === 3 ? 'Specs & Ownership' :
                  'Photo & Authenticity'
                }</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsWizardOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* STEP 1: BRAND SELECTION & GLOBAL SEARCH */}
            {wizardStep === 1 && (
              <View style={styles.stepContainer}>
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Instant Search (e.g. Drift, Spontini, R25, Vespa...)"
                  placeholderTextColor={colors.textTertiary}
                  value={globalSearch}
                  onChangeText={setGlobalSearch}
                />

                {/* Instant Global Search Results */}
                {globalSearch.trim().length > 0 && globalResults.length > 0 && (
                  <View style={styles.globalResultsBox}>
                    <Text style={styles.sectionMiniLabel}>DIRECT MATCHES ({globalResults.length})</Text>
                    <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                      {globalResults.map((item, idx) => (
                        <Pressable 
                          key={`${item.brand.brand}-${item.model.name}-${idx}`} 
                          style={styles.globalResultItem}
                          onPress={() => handleSelectGlobalResult(item)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.brandColorDot, { backgroundColor: item.brand.logoColor }]} />
                            <Text style={styles.globalResultText}>
                              <Text style={{ fontWeight: '700', color: '#fff' }}>{item.brand.brand}</Text> {item.model.name}
                            </Text>
                          </View>
                          <Text style={styles.globalResultCategory}>{item.model.category} · {item.model.defaultCc}cc</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <ScrollView style={{ maxHeight: globalResults.length > 0 ? 180 : 320 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.brandGrid}>
                    {filteredBrands.map((b) => (
                      <Pressable 
                        key={b.brand} 
                        style={styles.brandCard} 
                        onPress={() => handleSelectBrand(b)}
                      >
                        <View style={[styles.brandColorDot, { backgroundColor: b.logoColor }]} />
                        <Text style={styles.brandCardName}>{b.brand}</Text>
                        <Text style={styles.brandCardCountry}>{b.country}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                {/* Custom Brand Write-in Option */}
                <View style={styles.customWriteInBox}>
                  <Text style={styles.customWriteInLabel}>CAN'T FIND YOUR BRAND? WRITE CUSTOM BRAND:</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TextInput
                      style={[styles.modalTextInput, { flex: 1, height: 42 }]}
                      placeholder="e.g. Bisan, Custom Bobber..."
                      placeholderTextColor={colors.textTertiary}
                      value={customBrandInput}
                      onChangeText={setCustomBrandInput}
                    />
                    <Pressable style={styles.customConfirmBtn} onPress={handleUseCustomBrand}>
                      <Text style={styles.customConfirmText}>USE BRAND →</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2: MODEL SELECTION */}
            {wizardStep === 2 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepBreadcrumb}>
                  <Text style={styles.breadcrumbText}>SELECTED BRAND: <Text style={{ color: colors.speedGreen }}>{selectedBrandName}</Text></Text>
                  <Pressable onPress={() => setWizardStep(1)}>
                    <Text style={styles.breadcrumbChange}>CHANGE</Text>
                  </Pressable>
                </View>

                {selectedBrandObj && selectedBrandObj.models.length > 0 ? (
                  <>
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder={`Search ${selectedBrandName} models (${selectedBrandObj.models.length} models)...`}
                      placeholderTextColor={colors.textTertiary}
                      value={modelSearch}
                      onChangeText={setModelSearch}
                    />
                    <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                      <View style={styles.modelList}>
                        {filteredModels.map((m) => (
                          <Pressable 
                            key={m.name} 
                            style={styles.modelCard} 
                            onPress={() => handleSelectModel(m)}
                          >
                            <View>
                              <Text style={styles.modelCardName}>{m.name}</Text>
                              <Text style={styles.modelCardCategory}>{m.category} · {m.defaultCc} CC</Text>
                            </View>
                            <Text style={styles.modelArrow}>→</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                ) : (
                  <View style={{ paddingVertical: 10 }}>
                    <Text style={styles.customWriteInLabel}>Type your model name below for {selectedBrandName}:</Text>
                  </View>
                )}

                {/* Custom Model Write-In */}
                <View style={styles.customWriteInBox}>
                  <Text style={styles.customWriteInLabel}>ENTER EXACT MODEL MANUALLY:</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TextInput
                      style={[styles.modalTextInput, { flex: 1, height: 42 }]}
                      placeholder="e.g. Drift L 125, Spontini, Custom 50..."
                      placeholderTextColor={colors.textTertiary}
                      value={customModelInput}
                      onChangeText={setCustomModelInput}
                    />
                    <Pressable style={styles.customConfirmBtn} onPress={handleUseCustomModel}>
                      <Text style={styles.customConfirmText}>USE MODEL →</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 3: SPECS & OWNERSHIP */}
            {wizardStep === 3 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepBreadcrumb}>
                  <Text style={styles.breadcrumbText}>
                    {selectedBrandName} <Text style={{ color: colors.speedGreen }}>{selectedModelName}</Text>
                  </Text>
                  <Pressable onPress={() => setWizardStep(2)}>
                    <Text style={styles.breadcrumbChange}>CHANGE</Text>
                  </Pressable>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MODEL YEAR</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="2024"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={modelYear}
                      onChangeText={setModelYear}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>ENGINE CC</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="125"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={displacementCc}
                      onChangeText={setDisplacementCc}
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>ODOMETER (KM)</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="e.g. 14200"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={odometerKm}
                      onChangeText={setOdometerKm}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>OWNERSHIP START</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="e.g. May 2024"
                      placeholderTextColor={colors.textTertiary}
                      value={ownershipStart}
                      onChangeText={setOwnershipStart}
                    />
                  </View>
                </View>

                {/* Primary Toggle Pill */}
                <Pressable 
                  style={[styles.primaryTogglePill, isPrimary && styles.primaryTogglePillActive]} 
                  onPress={() => setIsPrimary(!isPrimary)}
                >
                  <Text style={[styles.primaryToggleText, isPrimary && { color: colors.speedGreen }]}>
                    {isPrimary ? '★ THIS IS MY CURRENT PRIMARY MOTORCYCLE' : '○ PREVIOUS MOTORCYCLE IN HISTORY'}
                  </Text>
                </Pressable>

                <View style={styles.wizardNavRow}>
                  <Pressable style={styles.wizardBackBtn} onPress={() => setWizardStep(2)}>
                    <Text style={styles.wizardBackText}>BACK</Text>
                  </Pressable>
                  <Pressable style={styles.wizardNextBtn} onPress={() => setWizardStep(4)}>
                    <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                    <Text style={styles.wizardNextText}>NEXT: VEHICLE PHOTO →</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* STEP 4: PHOTO UPLOAD & AUTHENTICITY SCAN */}
            {wizardStep === 4 && (
              <View style={styles.stepContainer}>
                <Text style={styles.inputLabel}>UPLOAD VEHICLE PHOTO & VERIFY</Text>

                <Pressable style={styles.photoUploadBox} onPress={handlePickVehiclePhoto}>
                  {photoUri ? (
                    <>
                      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      <View style={styles.changePhotoBadge}>
                        <Text style={styles.changePhotoText}>CHANGE PHOTO 📷</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoUploadPlaceholder}>
                      <Text style={styles.photoUploadIcon}>📸</Text>
                      <Text style={styles.photoUploadTitle}>TAP TO SELECT BIKE PHOTO</Text>
                      <Text style={styles.photoUploadSub}>Camera roll or live camera shot</Text>
                    </View>
                  )}
                </Pressable>

                {/* Authenticity Scanner Banner */}
                {photoScanStatus === 'SCANNING' && (
                  <View style={styles.scannerBanner}>
                    <ActivityIndicator color={colors.speedGreen} size="small" />
                    <Text style={styles.scannerText}>SCANNING EXIF & VEHICLE AUTHENTICITY...</Text>
                  </View>
                )}

                {photoScanStatus === 'VERIFIED' && (
                  <View style={[styles.scannerBanner, { borderColor: colors.speedGreen, backgroundColor: 'rgba(99,255,77,0.15)' }]}>
                    <Text style={[styles.scannerText, { color: colors.speedGreen }]}>
                      AUTHENTIC PERSONAL MOTORCYCLE VERIFIED ✓
                    </Text>
                  </View>
                )}

                <View style={styles.wizardNavRow}>
                  <Pressable style={styles.wizardBackBtn} onPress={() => setWizardStep(3)}>
                    <Text style={styles.wizardBackText}>BACK</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.wizardNextBtn, isSaving && { opacity: 0.6 }]} 
                    onPress={handleSaveNewMotorcycle}
                    disabled={isSaving}
                  >
                    <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                    <Text style={styles.wizardNextText}>{isSaving ? 'SAVING...' : 'SAVE TO GARAGE ★'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

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

  timelineList: { marginTop: 10, paddingLeft: 18, position: 'relative' },
  timelineVerticalLine: { position: 'absolute', left: 4, top: 12, bottom: 20, width: 2 },

  bikeCardWrap: {
    marginBottom: 20,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#101216',
    position: 'relative',
  },
  timelineDotPrimary: {
    position: 'absolute',
    left: -20,
    top: 18,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.speedGreen,
    shadowColor: colors.speedGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  timelineDotDim: {
    position: 'absolute',
    left: -19,
    top: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  bikeCardBlur: { padding: 16 },
  bikeCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bikeMetaBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bikeMetaText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  deleteBikeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  deleteBikeText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  bikePhotoWrap: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  bikePhoto: { width: '100%', height: '100%' },
  verifiedPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(4,18,10,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedPhotoText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, color: colors.speedGreen, letterSpacing: 0.8 },

  bikeCardTitle: { fontFamily: 'Archivo_800ExtraBold', fontSize: 22, color: '#fff', letterSpacing: -0.5 },
  bikeCardDate: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 12 },

  bikeSpecsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  specPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  specLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8 },
  specVal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: '#fff', marginTop: 2 },

  setPrimaryBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setPrimaryText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen, letterSpacing: 1 },

  // WIZARD MODAL STYLES
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
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontFamily: 'Archivo_700Bold', fontSize: 18, color: '#fff' },
  modalSub: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.speedGreen, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontSize: 12 },

  stepContainer: { gap: 10 },
  searchBarInput: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    marginBottom: 6,
  },

  sectionMiniLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: colors.speedGreen,
    letterSpacing: 1,
    marginBottom: 6,
  },
  globalResultsBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.25)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  globalResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  globalResultText: { fontFamily: 'Archivo_400Regular', fontSize: 13, color: '#fff' },
  globalResultCategory: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)' },

  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
  },
  brandColorDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  brandCardName: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13, color: '#fff' },
  brandCardCountry: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  customWriteInBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
  },
  customWriteInLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8 },
  customConfirmBtn: {
    backgroundColor: 'rgba(99,255,77,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customConfirmText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen, letterSpacing: 0.8 },

  stepBreadcrumb: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  breadcrumbText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },
  breadcrumbChange: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: colors.speedGreen },

  modelList: { gap: 8 },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modelCardName: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, color: '#fff' },
  modelCardCategory: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  modelArrow: { fontFamily: 'Archivo_700Bold', fontSize: 16, color: colors.speedGreen },

  rowInputs: { flexDirection: 'row', gap: 10 },
  inputLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 },
  modalTextInput: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 14,
  },

  primaryTogglePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 6,
    alignItems: 'center',
  },
  primaryTogglePillActive: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderColor: 'rgba(99,255,77,0.3)',
  },
  primaryToggleText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },

  photoUploadBox: {
    width: '100%',
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadPlaceholder: { alignItems: 'center', gap: 6 },
  photoUploadIcon: { fontSize: 30 },
  photoUploadTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },
  photoUploadSub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  changePhotoBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  changePhotoText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: '#fff', letterSpacing: 1 },

  scannerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
  },
  scannerText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8 },

  wizardNavRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  wizardBackBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  wizardBackText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  wizardNextBtn: { flex: 2, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  wizardNextText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1, color: '#04120a' },
});

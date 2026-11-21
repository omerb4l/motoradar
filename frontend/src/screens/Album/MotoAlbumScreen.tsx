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
import * as Location from 'expo-location';
import {
  AlbumPost,
  createAlbumPost,
  fetchAlbumPosts,
  removeAlbumPost,
} from '@/services/api/albumApi';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_STARTER_MEMORIES: Partial<AlbumPost>[] = [
  {
    id: 'demo-1',
    photo_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    caption: 'Sunday dawn run through the canyon twisties. Crisp morning air, warm tyres, pure focus.',
    location_name: 'Belgrad Ormanı, İstanbul',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'demo-2',
    photo_url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    caption: 'Sunset cruise along the coastal highway after a long week. Nothing clears the head quite like this.',
    location_name: 'Şile Sahil Yolu',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
];

export function MotoAlbumScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<AlbumPost[]>([]);
  const [viewMode, setViewMode] = useState<'FEED' | 'GRID'>('FEED');

  // New Memory Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPosts = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await fetchAlbumPosts(token);
      setPosts(data);
    } catch (err) {
      console.warn('Failed to load album posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [token]);

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please allow camera roll access to add ride photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setSelectedPhotoUri(uri);
      }
    } catch (err) {
      console.warn('Failed to pick photo:', err);
      Alert.alert('Notice', 'Unable to pick the selected photo. Please try choosing another photo.');
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to detect your location.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);

      // Reverse geocode to readable address / district
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocoded && geocoded.length > 0) {
        const place = geocoded[0];
        const readable = [place.subregion || place.district, place.city || place.region]
          .filter(Boolean)
          .join(', ');
        setLocationName(readable || 'Current Location');
      } else {
        setLocationName('Current Location');
      }
    } catch (err) {
      console.error('Failed to fetch location', err);
      setLocationName('Location Pin');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveMemory = async () => {
    if (!token) return;
    if (!selectedPhotoUri) {
      Alert.alert('Photo Required', 'Please select a photo for your ride memory.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newPost = await createAlbumPost(token, {
        photoUrl: selectedPhotoUri,
        caption: caption.trim() || undefined,
        locationName: locationName.trim() || undefined,
        latitude,
        longitude,
      });

      setPosts((prev) => [newPost, ...prev]);

      setSelectedPhotoUri(null);
      setCaption('');
      setLocationName('');
      setLatitude(undefined);
      setLongitude(undefined);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save ride memory', err);
      Alert.alert('Error', 'Failed to save ride memory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete Memory', 'Are you sure you want to delete this ride photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await removeAlbumPost(token, postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (err) {
            console.error('Failed to delete post', err);
          }
        },
      },
    ]);
  };

  const displayPosts = posts.length > 0 ? posts : DEFAULT_STARTER_MEMORIES;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 50) }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Moto Album</Text>
          <Text style={styles.screenSubtitle}>{posts.length} RIDE MEMORIES</Text>
        </View>

        <Pressable 
          style={styles.addBtnHeaderPill} 
          onPress={() => {
            setSelectedPhotoUri(null);
            setCaption('');
            setLocationName('');
            setIsModalOpen(true);
          }} 
          hitSlop={8}
        >
          <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
          <Text style={styles.addBtnHeaderText}>+ POST</Text>
        </Pressable>
      </View>

      {/* VIEW TOGGLE */}
      <View style={styles.viewToggleRow}>
        <Pressable 
          style={[styles.toggleBtn, viewMode === 'FEED' && styles.toggleBtnActive]} 
          onPress={() => setViewMode('FEED')}
        >
          <Text style={[styles.toggleText, viewMode === 'FEED' && styles.toggleTextActive]}>FEED VIEW 📑</Text>
        </Pressable>
        <Pressable 
          style={[styles.toggleBtn, viewMode === 'GRID' && styles.toggleBtnActive]} 
          onPress={() => setViewMode('GRID')}
        >
          <Text style={[styles.toggleText, viewMode === 'GRID' && styles.toggleTextActive]}>GRID VIEW ▦</Text>
        </Pressable>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.speedGreen} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {viewMode === 'FEED' ? (
            /* FEED VIEW: Instagram / Rider Journal Cards */
            displayPosts.map((post) => {
              const postDate = new Date(post.created_at || Date.now());
              const dateStr = postDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <View key={post.id} style={styles.feedCard}>
                  <BlurView intensity={24} tint="dark" style={styles.feedCardBlur}>
                    <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

                    {/* Card Top Info */}
                    <View style={styles.feedCardTop}>
                      <View style={styles.feedCardMeta}>
                        <Text style={styles.feedCardDate}>{dateStr.toUpperCase()}</Text>
                        {post.location_name ? (
                          <View style={styles.locationPill}>
                            <Text style={styles.locationIcon}>📍</Text>
                            <Text style={styles.locationText}>{post.location_name}</Text>
                          </View>
                        ) : null}
                      </View>

                      {post.id && !post.id.startsWith('demo-') && (
                        <Pressable style={styles.deletePostBtn} onPress={() => handleDeletePost(post.id!)} hitSlop={10}>
                          <Text style={styles.deletePostText}>✕</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Photo */}
                    <View style={styles.feedPhotoWrap}>
                      <Image source={{ uri: post.photo_url }} style={styles.feedPhoto} resizeMode="cover" />
                    </View>

                    {/* Caption / Rider Story */}
                    {post.caption ? (
                      <View style={styles.captionWrap}>
                        <Text style={styles.captionText}>{post.caption}</Text>
                      </View>
                    ) : null}

                  </BlurView>
                </View>
              );
            })
          ) : (
            /* GRID VIEW: Clean 3x3 Photo Matrix */
            <View style={styles.gridContainer}>
              {displayPosts.map((post) => (
                <View key={post.id} style={styles.gridSquare}>
                  <Image source={{ uri: post.photo_url }} style={styles.gridImage} resizeMode="cover" />
                  {post.location_name ? (
                    <View style={styles.gridLocationBadge}>
                      <Text style={styles.gridLocationText} numberOfLines={1}>{post.location_name}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}

      {/* NEW RIDE MEMORY POST MODAL */}
      {/* ADD MEMORY MODAL */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalBlurCard}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>NEW RIDE MEMORY</Text>
                <Text style={styles.modalSub}>Capture your bike, caption the moment, and tag the road.</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Photo Picker Area */}
            <Pressable style={styles.modalPhotoPicker} onPress={handlePickPhoto}>
              {selectedPhotoUri ? (
                <>
                  <Image source={{ uri: selectedPhotoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.changePhotoBadge}>
                    <Text style={styles.changePhotoText}>CHANGE PHOTO 📷</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPickerPlaceholder}>
                  <Text style={styles.photoPickerIcon}>📸</Text>
                  <Text style={styles.photoPickerTitle}>TAP TO SELECT PHOTO</Text>
                  <Text style={styles.photoPickerSub}>From your device camera roll</Text>
                </View>
              )}
            </Pressable>

            {/* Caption Input */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>RIDE STORY / CAPTION</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="What made this ride special? The roads, weather, pace..."
              placeholderTextColor={colors.textTertiary}
              multiline
              value={caption}
              onChangeText={setCaption}
            />

            {/* Location Tag */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>ROAD / LOCATION (OPTIONAL)</Text>
            <View style={styles.locationInputRow}>
              <TextInput
                style={styles.locationInput}
                placeholder="e.g. Belgrad Ormanı, Şile Virajları"
                placeholderTextColor={colors.textTertiary}
                value={locationName}
                onChangeText={setLocationName}
              />
              <Pressable 
                style={[styles.useGpsBtn, isLocating && { opacity: 0.6 }]} 
                onPress={handleUseCurrentLocation}
                disabled={isLocating}
              >
                <Text style={styles.useGpsText}>{isLocating ? '...' : '📍 GPS'}</Text>
              </Pressable>
            </View>

            {/* Submit Action */}
            <View style={styles.modalActionRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.6 }]} 
                onPress={handleSaveMemory}
                disabled={isSubmitting}
              >
                <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                <Text style={styles.modalSubmitText}>
                  {isSubmitting ? 'PUBLISHING...' : 'SAVE MEMORY'}
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

  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderColor: 'rgba(99,255,77,0.3)',
  },
  toggleText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },
  toggleTextActive: {
    color: colors.speedGreen,
  },

  // FEED STYLES
  feedCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#101216',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  feedCardBlur: {
    padding: 14,
  },
  feedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  feedCardDate: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.speedGreen,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  locationIcon: { fontSize: 10 },
  locationText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  deletePostBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePostText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  feedPhotoWrap: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feedPhoto: { width: '100%', height: '100%' },

  captionWrap: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  captionText: {
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
  },

  // GRID STYLES
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridSquare: {
    width: (SCREEN_WIDTH - 48) / 2,
    height: (SCREEN_WIDTH - 48) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  gridLocationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gridLocationText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    color: '#fff',
  },

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

  modalPhotoPicker: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickerPlaceholder: { alignItems: 'center', gap: 6 },
  photoPickerIcon: { fontSize: 32 },
  photoPickerTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },
  photoPickerSub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  changePhotoBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  changePhotoText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: '#fff', letterSpacing: 1 },

  inputLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 6 },
  captionInput: {
    height: 70,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#ffffff',
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    textAlignVertical: 'top',
  },

  locationInputRow: { flexDirection: 'row', gap: 8 },
  locationInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#ffffff',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
  },
  useGpsBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  useGpsText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: colors.speedGreen },

  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1, color: '#04120a' },
});

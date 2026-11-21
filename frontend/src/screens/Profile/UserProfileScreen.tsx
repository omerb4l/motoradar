import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GarageMetricCards } from '@/components/garage/GarageMetricCards';
import { fetchPublicUserProfile, MotorcycleData, UserProfileData } from '@/services/api/userApi';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/services/socket/socketClient';
import { colors } from '@/theme/colors';
import { Pressable } from 'react-native';

export function UserProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const userId = route.params?.userId;
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Partial<UserProfileData> | null>(null);
  const [motorcycles, setMotorcycles] = useState<MotorcycleData[]>([]);

  const primaryBike = motorcycles.find((b) => b.isPrimary) ?? motorcycles[0];

  useEffect(() => {
    if (!token || !userId) return;
    fetchPublicUserProfile(token, userId)
      .then((data) => {
        setProfile(data.profile);
        setMotorcycles(data.motorcycles);
      })
      .catch((err) => {
        console.warn('Failed to fetch user profile:', err);
        setError('User not found or profile is private.');
      })
      .finally(() => setLoading(false));
  }, [token, userId]);

  const [requestSent, setRequestSent] = useState(false);

  const handleRideRequest = () => {
    getSocket()?.emit('send_rendezvous', {
      recipientId: userId,
      type: 'RIDE_REQUEST',
    });
    setRequestSent(true);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.speedGreen} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        
        {/* Cinematic Header Image */}
        <View style={styles.heroWrap}>
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
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text style={styles.profileText}>@{profile.username}</Text>
            <View style={{ width: 38 }} />
          </View>
        </View>

        <View style={styles.detailsWrap}>
          <Text style={styles.bikeTitle}>
            {primaryBike ? `${primaryBike.brand} ${primaryBike.model}`.toUpperCase() : 'NO MOTORCYCLE'}
          </Text>
          <Text style={styles.bikeSubtitle}>
            {primaryBike ? `${primaryBike.displacementCc} cc · ${primaryBike.modelYear}` : 'No motorcycle linked'}
          </Text>

          {/* RIDE REQUEST ACTIONS */}
          {user?.id !== userId && (
            <View style={styles.actionRow}>
              <Pressable 
                style={[styles.actionBtn, styles.actionBtnPrimary, requestSent && { opacity: 0.5 }]} 
                onPress={() => !requestSent && handleRideRequest()}
              >
                <LinearGradient colors={requestSent ? ['#333', '#222'] : ['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                <Text style={[styles.actionBtnText, { color: requestSent ? '#999' : '#04120a' }]}>
                  {requestSent ? 'REQUEST SENT' : "SEND RIDE REQUEST"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Dynamic Metric Cards */}
          {primaryBike && (
            <View style={styles.cards}>
              <GarageMetricCards
                topSpeed={primaryBike.topSpeed ?? 285}
                topSpeedUnit={primaryBike.topSpeedUnit ?? 'km/h'}
                topSpeedContext={primaryBike.topSpeedContext ?? 'TRACK RECORD'}
                maxLeanDeg={primaryBike.maxLeanDeg ?? 52}
                maxLeanSide={primaryBike.maxLeanSide ?? 'LEFT'}
                maxLeanContext={primaryBike.maxLeanContext ?? 'CANYON RUN'}
              />
            </View>
          )}

          {/* BIO */}
          {profile.bio && (
            <View style={[styles.cardWrap, { marginTop: primaryBike ? 0 : 20 }]}>
              <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
                <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.cardTitle}>BIO</Text>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </BlurView>
            </View>
          )}

          {/* MOTO ALBUM */}
          <View style={[styles.cardWrap, { marginTop: 14 }]}>
            <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.025)']} style={StyleSheet.absoluteFill} />
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>MOTO ALBUM · 14</Text>
                <Text style={styles.cardAction}>ALL →</Text>
              </View>
              
              <View style={styles.albumGrid}>
                {/* Hero Shot (Left) */}
                <View style={styles.albumHero}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                  <Text style={styles.albumHeroLabel}>[ HERO SHOT ]</Text>
                </View>
                
                {/* Right Side Grid (2x2) */}
                <View style={styles.albumRightCol}>
                  <View style={styles.albumRow}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1590209795159-25ea1ff292f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' }} style={styles.albumSmallImg} />
                    <View style={styles.albumSmallImgPlay}>
                      <Image source={{ uri: 'https://images.unsplash.com/photo-1621345479029-7988880fcb12?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                      <View style={styles.playIconOutline}>
                        <View style={styles.playIconTriangle} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.albumRow}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' }} style={styles.albumSmallImg} />
                    <View style={styles.albumMoreWrap}>
                      <Text style={styles.albumMoreText}>+10</Text>
                    </View>
                  </View>
                </View>
              </View>
            </BlurView>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, backgroundColor: '#08080a', alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'JetBrainsMono_400Regular', color: 'rgba(255,255,255,0.5)', marginTop: 20 },
  container: { flex: 1, backgroundColor: '#08080a' },
  content: { paddingBottom: 140 },
  heroWrap: { height: 390, width: '100%', position: 'relative' },
  headerTop: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: 'Archivo_600SemiBold', fontSize: 22, color: '#fff', marginBottom: 2 },
  profileText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, color: '#fff', letterSpacing: 1 },
  
  detailsWrap: { paddingHorizontal: 16, marginTop: -40, zIndex: 2 },
  bikeTitle: { fontFamily: 'Archivo_800ExtraBold', fontSize: 38, letterSpacing: -1.14, color: '#fff' },
  bikeSubtitle: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 4 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary: { },
  actionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 0.8 },

  cards: { marginVertical: 20 },
  
  cardWrap: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#111214' },
  cardBlur: { padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, letterSpacing: 1.54, color: 'rgba(255,255,255,0.5)' },
  cardAction: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  
  bioText: { fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.82)', marginTop: 12 },
  
  albumGrid: { flexDirection: 'row', gap: 8, marginTop: 14, height: 216 },
  albumHero: { flex: 2, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  albumHeroLabel: { position: 'absolute', left: 0, right: 0, bottom: 9, textAlign: 'center', fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.32)' },
  albumRightCol: { flex: 2, gap: 8 },
  albumRow: { flex: 1, flexDirection: 'row', gap: 8 },
  albumSmallImg: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  albumSmallImgPlay: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  playIconOutline: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  playIconTriangle: { width: 0, height: 0, borderLeftWidth: 8, borderLeftColor: '#fff', borderTopWidth: 5, borderTopColor: 'transparent', borderBottomWidth: 5, borderBottomColor: 'transparent', marginLeft: 3 },
  albumMoreWrap: { flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  albumMoreText: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

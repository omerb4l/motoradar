import React, { useState } from 'react';
import { 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Switch, 
  Text, 
  View, 
  TextInput,
  Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useRidingStore } from '@/store/useRidingStore';
import { colors } from '@/theme/colors';
import { fetchUserProfile, updateUserProfile, UserProfileData } from '@/services/api/userApi';
import { getSocket } from '@/services/socket/socketClient';
import * as Location from 'expo-location';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, logout } = useAuthStore();
  const { speedUnit, setSpeedUnit, ghostMode, setGhostMode } = useSettingsStore();
  const isRiding = useRidingStore((s) => s.isRiding);
  
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [crash, setCrash] = useState(true);
  const [beacon, setBeacon] = useState(false);
  const [spotify, setSpotify] = useState(false);
  const [emgName, setEmgName] = useState('');
  const [emgPhone, setEmgPhone] = useState('');
  const [isSavingEmg, setIsSavingEmg] = useState(false);

  React.useEffect(() => {
    if (token) {
      fetchUserProfile(token).then((data) => {
        setProfile(data.profile);
        setGhostMode(data.profile.ghostModeActive);
        setEmgName(data.profile.emergencyContactName || '');
        setEmgPhone(data.profile.emergencyContactPhone || '');
      }).catch(console.error);
    }
  }, [token]);

  const handleToggleGhost = async (val: boolean) => {
    setGhostMode(val);
    if (token) {
      try {
        await updateUserProfile(token, { ghostModeActive: val });
      } catch(e) {
        setGhostMode(!val); // revert on error
        console.error(e);
      }
    }
  };

  const handleSaveEmg = async () => {
    if (!token) return;
    setIsSavingEmg(true);
    try {
      await updateUserProfile(token, { emergencyContactName: emgName, emergencyContactPhone: emgPhone });
      Alert.alert('Saved', 'Emergency contact updated successfully.');
    } catch(e) {
      console.error(e);
    } finally {
      setIsSavingEmg(false);
    }
  };

  const handleSimulateCrash = async () => {
    try {
      const loc = await Location.getLastKnownPositionAsync() || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const socket = getSocket();
      if (socket && loc) {
        socket.emit('trigger_sos', {
          alertType: 'AUTO_CRASH',
          lat: loc.coords.latitude,
          lng: loc.coords.longitude
        });
        Alert.alert('Crash Broadcasted', 'Simulated auto-crash SOS beacon sent to nearby crew.');
      } else {
        Alert.alert('Cannot simulate', 'No GPS location or socket not connected.');
      }
    } catch(e) {
      Alert.alert('Error', 'Could not get location.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Solid Dark Gradient Backdrop */}
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* iOS MODAL DRAG HANDLE */}
      <View style={styles.sheetDragHandle} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Settings</Text>
          <Text style={styles.screenSubtitle}>PREFERENCES & SAFETY</Text>
        </View>
        <Pressable 
          style={styles.headerGlassCloseBtn} 
          onPress={() => navigation.goBack()} 
          hitSlop={12}
        >
          <Text style={styles.headerCloseIcon}>✕</Text>
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 40, 60) }]}
        showsVerticalScrollIndicator={false}
      >
        
        {/* GHOST MODE */}
        <View style={[styles.cardWrap, ghostMode && styles.ghostCardActive]}>
          <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
            <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFill} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>GHOST MODE</Text>
                <Text style={[styles.rowTitle, ghostMode && styles.ghostTextActive]}>
                  {ghostMode ? 'HIDDEN FROM MAP' : 'VISIBLE TO CREW'}
                </Text>
              </View>
              <Switch 
                value={ghostMode} 
                onValueChange={handleToggleGhost} 
                trackColor={{ true: colors.ghostSlate, false: 'rgba(255,255,255,0.12)' }}
                thumbColor={ghostMode ? '#9FB6D4' : 'rgba(255,255,255,0.3)'}
              />
            </View>
            <Text style={styles.hint}>
              {ghostMode 
                ? 'You are off the radar. You still see other riders, and SOS still fires — safety never sleeps.'
                : 'Your pin is live to your crew while you ride. Tap to disappear.'}
            </Text>
          </BlurView>
        </View>

        {/* SPOTIFY */}
        <View style={styles.cardWrap}>
          <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
            <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{spotify ? 'Spotify linked' : 'Link Spotify'}</Text>
                <Text style={styles.hint}>{spotify ? 'ELENA.V · SHARING NOW PLAYING ON MAP' : 'SHARE WHAT YOU RIDE TO, SEE WHAT THEY RIDE TO'}</Text>
              </View>
              <Pressable style={[styles.btn, spotify ? styles.btnUnlink : styles.btnLink]} onPress={() => setSpotify(!spotify)}>
                <Text style={[styles.btnText, spotify ? styles.btnTextUnlink : styles.btnTextLink]}>{spotify ? 'UNLINK' : 'LINK'}</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>

        <Text style={styles.sectionHeader}>SAFETY AUTOMATIONS</Text>
        <View style={styles.listCard}>
          <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
            <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.022)']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.listItem}>
              <View style={styles.flex}>
                <Text style={styles.listTitle}>Crash detection</Text>
                <Text style={styles.hint}>Auto-triggers SOS if g-force limits exceeded</Text>
              </View>
              <Switch 
                value={crash} 
                onValueChange={setCrash}
                trackColor={{ true: colors.speedGreen, false: 'rgba(255,255,255,0.12)' }}
              />
            </View>
            
            <View style={styles.listItem}>
              <View style={styles.flex}>
                <Text style={styles.listTitle}>Distress beacon</Text>
                <Text style={styles.hint}>Flash hazard lights on screen when parked</Text>
              </View>
              <Switch 
                value={beacon} 
                onValueChange={setBeacon}
                trackColor={{ true: '#FFC754', false: 'rgba(255,255,255,0.12)' }}
              />
            </View>

            <View style={[styles.listItem, styles.noBorder, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
              <Text style={styles.listTitle}>Emergency contacts</Text>
              
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>NAME</Text>
                <TextInput
                  style={styles.input}
                  value={emgName}
                  onChangeText={setEmgName}
                  placeholder="e.g. Elena"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
              
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>PHONE</Text>
                <TextInput
                  style={styles.input}
                  value={emgPhone}
                  onChangeText={setEmgPhone}
                  placeholder="+1 234 567 8900"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="phone-pad"
                />
              </View>

              <Pressable style={styles.btnSaveEmg} onPress={handleSaveEmg}>
                <Text style={styles.btnSaveEmgText}>{isSavingEmg ? 'SAVING...' : 'SAVE CONTACT'}</Text>
              </Pressable>
            </View>

          </BlurView>
        </View>

        <Text style={styles.sectionHeader}>PRIVACY & UNITS</Text>
        <View style={styles.listCard}>
          <BlurView intensity={24} tint="dark" style={styles.cardBlur}>
            <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.022)']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.listItem}>
              <Text style={styles.listTitle}>Who can see my garage</Text>
              <Text style={styles.listArrow}>CREW ›</Text>
            </View>
            
            <View style={styles.listItem}>
              <View style={styles.flex}>
                <Text style={styles.listTitle}>Speed unit</Text>
              </View>
              <View style={styles.segmentedControl}>
                <Pressable 
                  style={[styles.segmentBtn, speedUnit === 'km/h' && styles.segmentBtnActive]}
                  onPress={() => setSpeedUnit('km/h')}
                >
                  <Text style={[styles.segmentText, speedUnit === 'km/h' && styles.segmentTextActive]}>KM/H</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segmentBtn, speedUnit === 'mph' && styles.segmentBtnActive]}
                  onPress={() => setSpeedUnit('mph')}
                >
                  <Text style={[styles.segmentText, speedUnit === 'mph' && styles.segmentTextActive]}>MPH</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.listItem, styles.noBorder]}>
              <Text style={styles.listTitle}>Data & location history</Text>
              <Text style={styles.listArrow}>›</Text>
            </View>

          </BlurView>
        </View>

        <Pressable 
          style={[styles.signOutBtn, { borderColor: isRiding ? '#FF4D4D' : colors.speedGreen, backgroundColor: isRiding ? 'rgba(255,77,77,0.1)' : 'rgba(99,255,77,0.1)' }]} 
          onPress={() => {
            if (isRiding) {
              useRidingStore.getState().endRide();
            } else {
              useRidingStore.getState().updateTelemetry({
                speedMps: 19.4, // ~70 km/h
                headingDeg: 315,
                leanDeg: 32,
              });
              navigation.goBack();
            }
          }}
        >
          <Text style={[styles.signOutText, { color: isRiding ? '#FF4D4D' : colors.speedGreen }]}>
            {isRiding ? 'TEST: STOP RIDE MODE' : 'TEST: SIMULATE RIDE (70 KM/H)'}
          </Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={logout}>
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>

        <Pressable style={[styles.signOutBtn, { borderColor: '#FF9500', backgroundColor: 'rgba(255,149,0,0.1)' }]} onPress={handleSimulateCrash}>
          <Text style={[styles.signOutText, { color: '#FF9500' }]}>TEST: SIMULATE CRASH</Text>
        </Pressable>

        <Text style={styles.versionText}>MOTORADAR 1.4.0 · BUILD 288</Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#07080a',
  },
  sheetDragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    color: '#fff',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.speedGreen,
    marginTop: 2,
  },
  headerGlassCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerCloseIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  
  content: { 
    paddingHorizontal: 16, 
    paddingTop: 6,
  },
  
  cardWrap: { 
    borderRadius: 22, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)', 
    backgroundColor: '#111214', 
    marginBottom: 14,
  },
  ghostCardActive: { 
    borderColor: 'rgba(159,182,212,0.6)', 
    shadowColor: 'rgba(120,150,190,0.28)', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 1, 
    shadowRadius: 30, 
    elevation: 8,
  },
  cardBlur: { 
    padding: 18,
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  flex: { 
    flex: 1, 
    paddingRight: 12,
  },
  
  cardTitle: { 
    fontFamily: 'JetBrainsMono_600SemiBold', 
    fontSize: 10, 
    letterSpacing: 1.4, 
    color: 'rgba(255,255,255,0.35)', 
    marginBottom: 6,
  },
  rowTitle: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 17, 
    color: '#fff',
  },
  ghostTextActive: { 
    color: '#9FB6D4',
  },
  hint: { 
    fontFamily: 'JetBrainsMono_400Regular', 
    fontSize: 11, 
    lineHeight: 16, 
    color: 'rgba(255,255,255,0.4)', 
    marginTop: 10,
  },
  
  btn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12,
  },
  btnLink: { 
    backgroundColor: '#1ED760',
  },
  btnUnlink: { 
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnText: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 12, 
    letterSpacing: 0.5,
  },
  btnTextLink: { 
    color: '#04120a',
  },
  btnTextUnlink: { 
    color: 'rgba(255,255,255,0.7)',
  },
  
  sectionHeader: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 10, 
    letterSpacing: 1.4, 
    color: 'rgba(255,255,255,0.4)', 
    marginTop: 14, 
    marginBottom: 10, 
    marginLeft: 4,
  },
  listCard: { 
    borderRadius: 22, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.10)', 
    backgroundColor: '#111214', 
    marginBottom: 14,
  },
  listItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  noBorder: { 
    borderBottomWidth: 0,
  },
  listTitle: { 
    flex: 1, 
    fontFamily: 'Archivo_600SemiBold', 
    fontSize: 15, 
    color: '#fff',
  },
  listArrow: { 
    fontFamily: 'JetBrainsMono_400Regular', 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.42)',
  },
  
  signOutBtn: { 
    marginTop: 14, 
    height: 52, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,45,70,0.10)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,45,70,0.35)',
  },
  signOutText: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 13, 
    letterSpacing: 0.4, 
    color: '#FF6070',
  },
  versionText: { 
    fontFamily: 'JetBrainsMono_400Regular', 
    fontSize: 10, 
    letterSpacing: 1, 
    color: 'rgba(255,255,255,0.25)', 
    textAlign: 'center', 
    marginTop: 16,
  },
  
  inputWrap: { 
    marginBottom: 4,
  },
  inputLabel: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 9, 
    letterSpacing: 1.2, 
    color: 'rgba(255,255,255,0.4)', 
    marginBottom: 6, 
    marginLeft: 4,
  },
  input: { 
    height: 46, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    paddingHorizontal: 14, 
    fontFamily: 'JetBrainsMono_400Regular', 
    fontSize: 13, 
    color: '#fff', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnSaveEmg: { 
    marginTop: 6, 
    height: 42, 
    borderRadius: 12, 
    backgroundColor: 'rgba(99,255,77,0.15)', 
    borderWidth: 1, 
    borderColor: 'rgba(99,255,77,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  btnSaveEmgText: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 11, 
    letterSpacing: 1.2, 
    color: '#63FF4D',
  },
  
  segmentedControl: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderRadius: 10, 
    padding: 3,
  },
  segmentBtn: { 
    paddingHorizontal: 14, 
    paddingVertical: 7, 
    borderRadius: 8,
  },
  segmentBtnActive: { 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 4, 
    shadowOffset: { width: 0, height: 2 },
  },
  segmentText: { 
    fontFamily: 'JetBrainsMono_600SemiBold', 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.5)',
  },
  segmentTextActive: { 
    color: '#fff',
  },
});

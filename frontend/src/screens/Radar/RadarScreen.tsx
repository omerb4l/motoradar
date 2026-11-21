import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import MapView, { Marker, Region, Polyline } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { connectSocket } from '@/services/socket/socketClient';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useLeanAngleSensor } from '@/hooks/useLeanAngleSensor';
import { useRendezvousStore } from '@/store/useRendezvousStore';
import { useRidersStore } from '@/store/useRidersStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useRidingStore } from '@/store/useRidingStore';
import { FloatingSpeedWidget } from '@/components/hud/FloatingSpeedWidget';
import { RiderCockpitHUD } from '@/components/hud/RiderCockpitHUD';
import { NearbyRider } from '@/types/location';
import { colors } from '@/theme/colors';
import { getSocket } from '@/services/socket/socketClient';
import { API_BASE_URL } from '@/services/api/config';
import { useSosStore } from '@/store/useSosStore';

const INITIAL_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function RadarScreen() {
  const insets = useSafeAreaInsets();
  const [socketError, setSocketError] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [etaText, setEtaText] = useState<string | null>(null);
  
  const [showMeetupPrompt, setShowMeetupPrompt] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('NO_SHOW');
  const [promptedRendezvousId, setPromptedRendezvousId] = useState<string | null>(null);
  
  const mapRef = useRef<MapView | null>(null);
  const hasCenteredRef = useRef(false);

  const nearbyRiders = useRidersStore((s) => s.nearbyRiders);
  const setNearbyRiders = useRidersStore((s) => s.setNearbyRiders);
  const requests = useRendezvousStore((s) => s.requests);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isRiding = useRidingStore((s) => s.isRiding);
  const speedMps = useRidingStore((s) => s.speedMps);
  const setSpeed = useRidingStore((s) => s.setSpeed);
  
  const speedUnit = useSettingsStore((s) => s.speedUnit);
  const ghostMode = useSettingsStore((s) => s.ghostMode);
  const speedMultiplier = speedUnit === 'km/h' ? 3.6 : 2.23694;

  const activeSosAlerts = useSosStore((s) => s.activeAlerts);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    socket.on('nearby_riders_update', (riders: NearbyRider[]) => {
      setSocketError(null);
      setNearbyRiders(riders);
    });
    return () => {
      socket.off('nearby_riders_update');
    };
  }, [token, setNearbyRiders]);

  const { status, currentLocation, errorMessage, startTracking, stopTracking } =
    useLocationTracking();

  // Real Hardware Gyroscope & Motion Lean Sensor with Anti-Cheat
  useLeanAngleSensor(isRiding, speedMps);

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      setSpeed(Math.max(0, currentLocation.coords.speed ?? 0));
    }
  }, [currentLocation, setSpeed]);

  useEffect(() => {
    if (!currentLocation || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    recenterMap();
  }, [currentLocation]);

  const recenterMap = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        500
      );
    }
  };

  const clearSelectionAndReturnHome = () => {
    setSelectedRiderId(null);
    setRequestSent(false);
    recenterMap();
  };

  // Track the selected rider dynamically and continuously follow them as they move
  const targetRider = nearbyRiders.find((r) => r.userId === selectedRiderId);
  const targetLat = targetRider?.lat;
  const targetLng = targetRider?.lng;

  useEffect(() => {
    if (!selectedRiderId || targetLat === undefined || targetLng === undefined) return;
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: targetLat,
          longitude: targetLng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }
  }, [selectedRiderId, targetLat, targetLng]);

  // Handle active rendezvous routing & ETA
  const activeTravelRendezvous = requests.find(r => r.status === 'ACCEPTED' && r.travelingUserId);
  const iAmTraveling = activeTravelRendezvous?.travelingUserId === user?.id;
  const partnerId = activeTravelRendezvous?.requesterId === user?.id ? activeTravelRendezvous?.recipientId : activeTravelRendezvous?.requesterId;
  const partnerName = activeTravelRendezvous?.requesterId === user?.id ? activeTravelRendezvous?.recipientName : activeTravelRendezvous?.requesterName;

  const partnerLoc = nearbyRiders.find(r => 
    (partnerId && r.userId === partnerId) || 
    (partnerName && r.username?.toLowerCase() === partnerName.toLowerCase()) ||
    (partnerId && r.username?.toLowerCase() === partnerId.toLowerCase())
  );

  useEffect(() => {
    if (!activeTravelRendezvous) {
      setRouteCoordinates([]);
      setEtaText(null);
      return;
    }

    const startLat = currentLocation?.coords.latitude || 37.7749;
    const startLng = currentLocation?.coords.longitude || -122.4194;
    const endLat = partnerLoc ? partnerLoc.lat : (startLat + 0.015);
    const endLng = partnerLoc ? partnerLoc.lng : (startLng + 0.018);

    if (partnerLoc?.distanceKm !== undefined && partnerLoc.distanceKm < 0.1 && activeTravelRendezvous.id !== promptedRendezvousId) {
      setPromptedRendezvousId(activeTravelRendezvous.id);
      setShowMeetupPrompt(true);
    }

    // Instant smooth waypoint fallback
    const fallbackPoints = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = startLat + (endLat - startLat) * t + Math.sin(t * Math.PI) * 0.0028;
      const lng = startLng + (endLng - startLng) * t + Math.cos(t * Math.PI) * 0.0022;
      fallbackPoints.push({ latitude: lat, longitude: lng });
    }

    const dist = partnerLoc?.distanceKm !== undefined ? partnerLoc.distanceKm : 2.8;
    setEtaText(`${Math.max(2, Math.round(dist * 1.5))} MIN`);
    setRouteCoordinates(fallbackPoints);

    if (mapRef.current && fallbackPoints.length > 0) {
      mapRef.current.fitToCoordinates(fallbackPoints, {
        edgePadding: { top: 140, right: 70, bottom: 270, left: 70 },
        animated: true,
      });
    }

    if (iAmTraveling) {
      const fetchRoute = async () => {
        try {
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => ({
              latitude: c[1],
              longitude: c[0]
            }));
            setRouteCoordinates(coords);
            const durationSec = data.routes[0].duration;
            setEtaText(`${Math.ceil(durationSec / 60)} MIN`);

            if (mapRef.current && coords.length > 0) {
              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 140, right: 70, bottom: 270, left: 70 },
                animated: true,
              });
            }
          }
        } catch (e) {
          console.warn('OSRM route fallback active');
        }
      };
      fetchRoute();
    }
  }, [activeTravelRendezvous?.id, activeTravelRendezvous?.travelingUserId, partnerLoc?.lat, partnerLoc?.lng, currentLocation?.coords.latitude, currentLocation?.coords.longitude]);

  const selectedRider = nearbyRiders.find((r) => r.userId === selectedRiderId);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsCompass={false}
        userInterfaceStyle="dark"
        mapType="mutedStandard"
        onPress={clearSelectionAndReturnHome}
        onPanDrag={() => {
          if (selectedRiderId) {
            setSelectedRiderId(null);
            setRequestSent(false);
          }
        }}
      >
        {nearbyRiders.map((rider) => (
          <Marker
            key={rider.userId}
            coordinate={{ latitude: rider.lat, longitude: rider.lng }}
            centerOffset={{ x: 0, y: -16 }}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedRiderId(rider.userId);
              setRequestSent(false);
            }}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.pin, rider.isRiding && styles.pinRiding]}>
                <Text style={styles.pinText}>
                  {rider.username ? rider.username.slice(0, 2).toUpperCase() : 'MR'}
                </Text>
              </View>
              <View style={styles.speedBadgeWrap}>
                <Text style={styles.speedBadgeText}>{Math.round(rider.speed * speedMultiplier)}</Text>
              </View>
            </View>
          </Marker>
        ))}

        {routeCoordinates.length > 0 && (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="rgba(99,255,77,0.3)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.speedGreen}
              strokeWidth={4.5}
            />
          </>
        )}
      </MapView>

      {/* Ghost Mode Indicator */}
      {ghostMode && (
        <View style={[styles.ghostModeBadge, { top: Math.max(insets.top + 10, 50) }]}>
          <View style={styles.ghostModeDot} />
          <Text style={styles.ghostModeText}>GHOST ACTIVE</Text>
        </View>
      )}

      {/* TEMPORARY TEST BUTTON: SIMULATE RIDER HUD */}
      <Pressable 
        style={[styles.testHudBtn, { bottom: selectedRider ? 275 : 155 }]} 
        onPress={() => {
          if (isRiding) {
            useRidingStore.getState().endRide();
          } else {
            useRidingStore.getState().updateTelemetry({
              speedMps: 20.8, // 75 km/h
              headingDeg: 324,
              leanDeg: 38,
            });
          }
        }}
      >
        <BlurView intensity={40} tint="dark" style={styles.testHudBlur}>
          <Text style={[styles.testHudText, { color: isRiding ? '#FF4D4D' : colors.speedGreen }]}>
            {isRiding ? 'STOP' : 'TEST HUD'}
          </Text>
        </BlurView>
      </Pressable>

      {/* Re-center Floating Action Button */}
      <Pressable 
        style={[styles.recenterBtn, { bottom: selectedRider ? 220 : 100 }]} 
        onPress={recenterMap}
      >
        <BlurView intensity={30} tint="dark" style={styles.recenterBlur}>
          <Text style={styles.recenterIcon}>⌖</Text>
        </BlurView>
      </Pressable>

      {/* Incoming Active SOS Alerts (Only if real alerts exist) */}
      {activeSosAlerts.length > 0 && (
        <View style={[styles.incomingSosContainer, { top: insets.top + 60 }]}>
          {activeSosAlerts.map(alert => (
            <BlurView key={alert.id} intensity={50} tint="dark" style={styles.incomingSosCard}>
              <View style={styles.incomingSosHeader}>
                <View style={styles.incomingSosDot} />
                <Text style={styles.incomingSosTitle}>EMERGENCY ALERT</Text>
              </View>
              <Text style={styles.incomingSosName}>{alert.username.toUpperCase()}</Text>
              <Text style={styles.incomingSosType}>{alert.alertType === 'AUTO_CRASH' ? 'Crash Detected Nearby' : 'SOS Broadcast'}</Text>
            </BlurView>
          ))}
        </View>
      )}

      {/* MEETUP PROMPT MODAL */}
      <Modal transparent visible={showMeetupPrompt} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={50} tint="dark" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hedefe Varıldı</Text>
            <Text style={styles.modalSub}>Sürücü ile görüşebildiniz mi?</Text>
            
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.modalBtnNo]} onPress={() => {
                setShowMeetupPrompt(false);
                setShowReportModal(true);
              }}>
                <Text style={styles.modalBtnNoText}>HAYIR</Text>
              </Pressable>
              
              <Pressable style={[styles.modalBtn, styles.modalBtnYes]} onPress={() => {
                setShowMeetupPrompt(false);
                if (activeTravelRendezvous) {
                  getSocket()?.emit('respond_rendezvous', { requestId: activeTravelRendezvous.id, status: 'COMPLETED' });
                  useRendezvousStore.getState().updateStatus(activeTravelRendezvous.id, 'COMPLETED');
                }
                clearSelectionAndReturnHome();
              }}>
                <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                <Text style={styles.modalBtnYesText}>EVET</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* REPORT USER MODAL */}
      <Modal transparent visible={showReportModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#111316', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.modalTitle}>Kullanıcıyı Raporla</Text>
            <Text style={styles.modalSub}>Lütfen raporlama nedenini seçin:</Text>

            <View style={styles.reasonWrap}>
              <Pressable 
                style={[styles.reasonBtn, reportReason === 'NO_SHOW' && styles.reasonBtnActive]}
                onPress={() => setReportReason('NO_SHOW')}
              >
                <Text style={[styles.reasonText, reportReason === 'NO_SHOW' && styles.reasonTextActive]}>Kullanıcı Gelmedi (No-show)</Text>
              </Pressable>
              <Pressable 
                style={[styles.reasonBtn, reportReason === 'FAKE_LOCATION' && styles.reasonBtnActive]}
                onPress={() => setReportReason('FAKE_LOCATION')}
              >
                <Text style={[styles.reasonText, reportReason === 'FAKE_LOCATION' && styles.reasonTextActive]}>Yanlış Konum</Text>
              </Pressable>
              <Pressable 
                style={[styles.reasonBtn, reportReason === 'OTHER' && styles.reasonBtnActive]}
                onPress={() => setReportReason('OTHER')}
              >
                <Text style={[styles.reasonText, reportReason === 'OTHER' && styles.reasonTextActive]}>Diğer</Text>
              </Pressable>
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.modalBtnNo]} onPress={() => setShowReportModal(false)}>
                <Text style={styles.modalBtnNoText}>İPTAL</Text>
              </Pressable>
              
              <Pressable style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]} onPress={async () => {
                if (activeTravelRendezvous) {
                  const partnerIdForReport = activeTravelRendezvous.requesterId === user?.id ? activeTravelRendezvous.recipientId : activeTravelRendezvous.requesterId;
                  
                  try {
                    await fetch(`${API_BASE_URL}/reports`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        reportedId: partnerIdForReport,
                        rendezvousId: activeTravelRendezvous.id,
                        reason: reportReason,
                      }),
                    });
                  } catch(e) {
                    console.error('Failed to report user', e);
                  }

                  getSocket()?.emit('respond_rendezvous', { requestId: activeTravelRendezvous.id, status: 'CANCELLED' });
                  useRendezvousStore.getState().updateStatus(activeTravelRendezvous.id, 'CANCELLED');
                }
                setShowReportModal(false);
                clearSelectionAndReturnHome();
              }}>
                <Text style={styles.modalBtnYesText}>RAPORLA</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sleek Floating Speed & GPS Widget */}
      <FloatingSpeedWidget
        speed={speedMps * speedMultiplier}
        unit={speedUnit}
        visible={!isRiding && !selectedRiderId && !activeTravelRendezvous}
      />

      {/* ETA HUD when waiting */}
      {activeTravelRendezvous && !iAmTraveling && etaText && partnerLoc && (
        <View style={[styles.etaHudWrap, { top: Math.max(insets.top + 8, 50) }]}>
          <BlurView intensity={30} tint="dark" style={styles.etaHudBlur}>
            <Text style={styles.etaHudTitle}>INCOMING RIDER</Text>
            <Text style={styles.etaHudValue}>{partnerLoc.username?.toUpperCase() || 'RIDER'} · ETA {etaText}</Text>
          </BlurView>
        </View>
      )}

      {/* Routing HUD when traveling */}
      {activeTravelRendezvous && iAmTraveling && etaText && (
        <View style={[styles.etaHudWrap, { top: Math.max(insets.top + 8, 50) }]}>
          <BlurView intensity={30} tint="dark" style={styles.etaHudBlur}>
            <Text style={[styles.etaHudTitle, { color: colors.speedGreen }]}>ROUTING TO TARGET</Text>
            <Text style={styles.etaHudValue}>ETA {etaText}</Text>
          </BlurView>
        </View>
      )}

      {/* Floating Rider Profile Overlay */}
      {selectedRider && (
        <View style={styles.riderOverlayWrap}>
          <BlurView intensity={36} tint="dark" style={styles.riderOverlayBlur}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFill} />
            <View style={styles.roHeader}>
              <View style={styles.roAvatar}>
                <Text style={styles.roAvatarText}>{selectedRider.username ? selectedRider.username.slice(0, 2).toUpperCase() : 'MR'}</Text>
              </View>
              <View style={styles.roInfo}>
                <Text style={styles.roName}>{selectedRider.username || 'RIDER'}</Text>
                <Text style={styles.roBike}>
                  {selectedRider.distanceKm !== undefined ? `${selectedRider.distanceKm.toFixed(1)} km away` : 'Nearby'}
                </Text>
              </View>
              <View style={styles.roSpeed}>
                <Text style={styles.roSpeedText}>{Math.round(selectedRider.speed * speedMultiplier)}</Text>
                <Text style={styles.roSpeedUnit}>{speedUnit.toUpperCase()}</Text>
              </View>
            </View>

            {(() => {
              const existingReq = requests.find(r => r.requesterId === user?.id && r.recipientId === selectedRider.userId);
              const isPendingOrAccepted = existingReq && (existingReq.status === 'PENDING' || existingReq.status === 'ACCEPTED');
              
              return (
                <Pressable 
                  style={[styles.roActionBtn, (requestSent || isPendingOrAccepted) && { opacity: 0.6 }]} 
                  onPress={() => {
                    if (!requestSent && !isPendingOrAccepted) {
                      getSocket()?.emit('send_rendezvous', { recipientId: selectedRider.userId, type: 'RIDE_REQUEST' });
                      setRequestSent(true);
                      
                      useRendezvousStore.getState().addRequest({
                        id: Math.random().toString(),
                        requesterId: user?.id || '',
                        requesterName: user?.username || 'You',
                        recipientId: selectedRider.userId,
                        recipientName: selectedRider.username || 'Unknown',
                        type: 'RIDE_REQUEST',
                        status: 'PENDING'
                      });

                      setTimeout(() => {
                        clearSelectionAndReturnHome();
                      }, 900);
                    }
                  }}
                >
                  <LinearGradient 
                    colors={requestSent || isPendingOrAccepted ? ['#2a2c30', '#1c1d20'] : ['#63FF4D', '#3EB82C']} 
                    style={StyleSheet.absoluteFill} 
                  />
                  <Text style={[styles.roActionText, { color: requestSent || isPendingOrAccepted ? '#aaa' : '#04120a' }]}>
                    {requestSent ? 'REQUEST SENT' : isPendingOrAccepted ? 'ALREADY REQUESTED' : 'SEND RIDE REQUEST'}
                  </Text>
                </Pressable>
              );
            })()}
          </BlurView>
        </View>
      )}

      {/* RIDER COCKPIT HUD (Supports both Full Cockpit and Live Map Navigation Split View) */}
      <RiderCockpitHUD 
        visible={isRiding} 
        navigationInfo={{
          isNavigating: !!(activeTravelRendezvous && iAmTraveling && routeCoordinates.length > 0),
          partnerName: partnerLoc?.username,
          etaText: etaText,
          distanceKm: partnerLoc?.distanceKm,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d0c',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16181d',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  pinRiding: {
    borderColor: colors.speedGreen,
    backgroundColor: '#0d1e13',
  },
  pinText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    letterSpacing: 0.5,
    color: '#fff',
  },
  speedBadgeWrap: {
    backgroundColor: 'rgba(10,12,15,0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 3,
  },
  speedBadgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
  },

  testHudBtn: {
    position: 'absolute',
    right: 16,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    backgroundColor: 'rgba(12,14,18,0.7)',
    zIndex: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  testHudBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testHudText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1,
  },

  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(12,14,18,0.6)',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  recenterBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterIcon: {
    fontSize: 22,
    color: '#fff',
    lineHeight: 24,
  },

  riderOverlayWrap: {
    position: 'absolute',
    bottom: 95,
    left: 16,
    right: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(12,14,18,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    zIndex: 10,
  },
  riderOverlayBlur: {
    padding: 18,
  },
  roHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  roAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roAvatarText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  roInfo: {
    flex: 1,
  },
  roName: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.3,
  },
  roBike: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },
  roSpeed: {
    alignItems: 'flex-end',
  },
  roSpeedText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 22,
    color: colors.speedGreen,
  },
  roSpeedUnit: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    color: 'rgba(99,255,77,0.6)',
  },
  roActionBtn: {
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roActionText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    letterSpacing: 1,
  },

  etaHudWrap: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,12,16,0.6)',
    zIndex: 5,
  },
  etaHudBlur: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  etaHudTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  etaHudValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 14,
    color: '#fff',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#121418',
  },
  modalTitle: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 20,
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalBtnNo: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalBtnYes: {},
  modalBtnNoText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  modalBtnYesText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    color: '#000',
  },
  reasonWrap: {
    gap: 8,
    marginBottom: 20,
  },
  reasonBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reasonBtnActive: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
  reasonText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  reasonTextActive: {
    color: '#FF3B30',
    fontFamily: 'JetBrainsMono_700Bold',
  },

  ghostModeBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,18,22,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 5,
  },
  ghostModeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ghostSlate,
  },
  ghostModeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#fff',
  },

  incomingSosContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 10,
    zIndex: 10,
  },
  incomingSosCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,45,70,0.5)',
    backgroundColor: 'rgba(255,45,70,0.12)',
  },
  incomingSosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  incomingSosDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  incomingSosTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#FF3B30',
    letterSpacing: 1.2,
  },
  incomingSosName: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 17,
    color: '#fff',
  },
  incomingSosType: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  }
});

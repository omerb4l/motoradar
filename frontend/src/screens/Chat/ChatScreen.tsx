import React, { useEffect, useRef, useState } from 'react';
import { 
  KeyboardAvoidingView, 
  Platform, 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { useRidingStore } from '@/store/useRidingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRendezvousStore } from '@/store/useRendezvousStore';
import { useRidersStore } from '@/store/useRidersStore';
import { getSocket } from '@/services/socket/socketClient';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatScreenRouteProp>();
  const { chatId, partnerName, partnerId } = route.params;

  const user = useAuthStore((s) => s.user);
  const isRiding = useRidingStore((s) => s.isRiding);
  const [message, setMessage] = useState('');
  
  const rawMessages = useChatStore((s) => s.messagesByChat[chatId]);
  const messages = rawMessages || [];
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  
  const requests = useRendezvousStore((s) => s.requests);
  const proposeMeetup = useRendezvousStore((s) => s.proposeMeetup);
  const acceptMeetupProposal = useRendezvousStore((s) => s.acceptMeetupProposal);
  const declineMeetupProposal = useRendezvousStore((s) => s.declineMeetupProposal);
  const cancelActiveMeetup = useRendezvousStore((s) => s.cancelActiveMeetup);

  const nearbyRiders = useRidersStore((s) => s.nearbyRiders);
  const partnerLoc = nearbyRiders.find((r) => r.userId === partnerId);
  const distanceKm = partnerLoc?.distanceKm !== undefined ? Number(partnerLoc.distanceKm.toFixed(1)) : 4.8;
  const etaMinutes = Math.max(2, Math.round(distanceKm * 1.5));

  // Find active rendezvous for this chat or partner
  const activeRendezvous = requests.find(r => 
    (r.chatId === chatId || 
     (r.requesterId === partnerId && r.recipientId === user?.id) || 
     (r.recipientId === partnerId && r.requesterId === user?.id)) &&
    r.status !== 'CANCELLED' && r.status !== 'COMPLETED'
  );

  const isTraveling = activeRendezvous?.travelingUserId === user?.id;
  const isPartnerTraveling = activeRendezvous?.travelingUserId && activeRendezvous.travelingUserId === partnerId;
  const hasActiveTraveler = !!activeRendezvous?.travelingUserId;

  const isProposing = activeRendezvous?.proposingUserId === user?.id && !hasActiveTraveler;
  const hasIncomingProposal = activeRendezvous?.proposingUserId === partnerId && !hasActiveTraveler;

  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    fetchMessages(chatId);
  }, [chatId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // When meetup route is active and user is traveling, auto-navigate to Radar map!
  useEffect(() => {
    if (isTraveling && hasActiveTraveler) {
      const timer = setTimeout(() => {
        navigation.navigate('Tabs', { screen: 'Radar' } as any);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isTraveling, hasActiveTraveler]);
  
  const handleOpenProfile = () => {
    if (partnerId) {
      navigation.navigate('UserProfile', { userId: partnerId });
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;
    getSocket()?.emit('send_message', { chatId, body: message.trim() });
    setMessage('');
  };

  // Switch directly to Radar tab to see the live navigation route
  const handleOpenRadarMap = () => {
    navigation.navigate('Tabs', { screen: 'Radar' } as any);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0c0e', '#070809']} style={StyleSheet.absoluteFill} />
      
      {/* 1. HEADER */}
      <View style={styles.headerWrap}>
        <BlurView intensity={30} tint="dark" style={styles.headerBlur}>
          <SafeAreaView edges={['top']} style={styles.headerInner}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Pressable style={styles.avatar} onPress={handleOpenProfile}>
              <Text style={styles.avatarText}>{partnerName ? partnerName.slice(0, 2).toUpperCase() : 'R'}</Text>
            </Pressable>
            <Pressable style={styles.headerInfo} onPress={handleOpenProfile}>
              <Text style={styles.nameText}>{partnerName || 'Rider'}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>DIRECT CHANNEL · {distanceKm} KM</Text>
              </View>
            </Pressable>
          </SafeAreaView>
        </BlurView>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 2. TOP MEETUP ACTIONS BAR (BANA GEL & SANA GELİYORUM) */}
        <View style={[styles.meetupActionsBarWrap, { top: insets.top + 60 }]}>
          
          {/* A. Default State: No Active Route / No Proposal */}
          {!hasActiveTraveler && !isProposing && !hasIncomingProposal && (
            <View style={styles.quickMeetupRow}>
              <Pressable 
                style={styles.meetupBtn} 
                onPress={() => partnerId && proposeMeetup(partnerId, partnerName || 'Rider', 'COME_TO_ME', chatId)}
              >
                <LinearGradient colors={['rgba(99,255,77,0.14)', 'rgba(99,255,77,0.04)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.meetupBtnText}>COME TO ME 📍</Text>
              </Pressable>

              <Pressable 
                style={[styles.meetupBtn, styles.meetupBtnSecondary]} 
                onPress={() => partnerId && proposeMeetup(partnerId, partnerName || 'Rider', 'COMING_TO_YOU', chatId)}
              >
                <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                <Text style={[styles.meetupBtnText, { color: '#fff' }]}>I'M COMING TO YOU 🏍️</Text>
              </Pressable>
            </View>
          )}

          {/* B. Incoming Proposal from Partner */}
          {hasIncomingProposal && activeRendezvous && (
            <BlurView intensity={45} tint="dark" style={styles.proposalCard}>
              <LinearGradient colors={['rgba(99,255,77,0.15)', 'rgba(7,9,11,0.95)']} style={StyleSheet.absoluteFill} />
              <View style={styles.proposalHeaderRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.proposalTitle}>
                  {activeRendezvous.proposalType === 'COME_TO_ME'
                    ? `📍 @${partnerName} INVITED YOU TO MEET AT THEIR SPOT`
                    : `🏍️ @${partnerName} IS OFFERING TO RIDE TO YOU`}
                </Text>
              </View>
              <Text style={styles.proposalSub}>
                Distance: {distanceKm} KM · Estimated ride time: ~{etaMinutes} min
              </Text>
              <View style={styles.proposalActionRow}>
                <Pressable 
                  style={styles.proposalAcceptBtn}
                  onPress={() => {
                    const targetTraveler = activeRendezvous.proposalType === 'COME_TO_ME' ? user!.id : partnerId!;
                    acceptMeetupProposal(activeRendezvous.id, targetTraveler, chatId);
                  }}
                >
                  <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                  <Text style={styles.proposalAcceptText}>
                    {activeRendezvous.proposalType === 'COME_TO_ME' ? 'ACCEPT & START NAVIGATION 🏍️' : 'ACCEPT MEETUP ✓'}
                  </Text>
                </Pressable>
                <Pressable 
                  style={styles.proposalDeclineBtn}
                  onPress={() => declineMeetupProposal(activeRendezvous.id)}
                >
                  <Text style={styles.proposalDeclineText}>DECLINE</Text>
                </Pressable>
              </View>
            </BlurView>
          )}

          {/* C. Outgoing Proposal (Waiting for partner confirmation) */}
          {isProposing && activeRendezvous && (
            <BlurView intensity={35} tint="dark" style={styles.waitingCard}>
              <View style={styles.waitingRow}>
                <View style={styles.waitingDot} />
                <Text style={styles.waitingText}>
                  {activeRendezvous.proposalType === 'COME_TO_ME'
                    ? `Invitation sent! Waiting for @${partnerName} to accept...`
                    : `Offer sent! Waiting for @${partnerName} to accept...`}
                </Text>
              </View>
              <Pressable 
                style={styles.waitingCancelBtn}
                onPress={() => declineMeetupProposal(activeRendezvous.id)}
              >
                <Text style={styles.waitingCancelText}>CANCEL</Text>
              </Pressable>
            </BlurView>
          )}

          {/* D. Live Active Traveling / En Route State */}
          {hasActiveTraveler && activeRendezvous && (
            <BlurView intensity={45} tint="dark" style={styles.activeRouteCard}>
              <LinearGradient 
                colors={isTraveling ? ['rgba(99,255,77,0.18)', 'rgba(7,9,11,0.92)'] : ['rgba(255,165,0,0.16)', 'rgba(7,9,11,0.92)']} 
                style={StyleSheet.absoluteFill} 
              />
              <View style={styles.activeRouteHeaderRow}>
                <View style={[styles.livePulseDot, !isTraveling && { backgroundColor: '#FFA500' }]} />
                <Text style={[styles.activeRouteTitle, !isTraveling && { color: '#FFA500' }]}>
                  {isTraveling 
                    ? `📍 YOU ARE EN ROUTE TO @${partnerName?.toUpperCase()}` 
                    : `🏍️ @${partnerName?.toUpperCase()} IS ON THE WAY TO YOU`}
                </Text>
              </View>

              <Text style={styles.activeRouteSub}>
                {distanceKm} KM REMAINING · ESTIMATED TIME ~{etaMinutes} MIN
              </Text>

              <View style={styles.activeRouteBtnRow}>
                <Pressable style={styles.viewRadarBtn} onPress={handleOpenRadarMap}>
                  <Text style={styles.viewRadarBtnText}>VIEW ON RADAR ↗</Text>
                </Pressable>
                <Pressable style={styles.cancelRouteBtn} onPress={() => cancelActiveMeetup(activeRendezvous.id)}>
                  <Text style={styles.cancelRouteBtnText}>CANCEL MEETUP ✕</Text>
                </Pressable>
              </View>
            </BlurView>
          )}

        </View>

        {/* 3. CHAT MESSAGES */}
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.chatScroll, { paddingTop: insets.top + (hasActiveTraveler || hasIncomingProposal || isProposing ? 180 : 125) }]} 
          bounces={true}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIconText}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>Connected with {partnerName || 'Rider'}</Text>
              <Text style={styles.emptySub}>Send a message or tap "COME TO ME" above to start a live meetup.</Text>
            </View>
          )}

          {messages.map((msg) => {
            const isSelf = msg.sender_id === user?.id;
            return (
              <View 
                key={msg.id} 
                style={[
                  styles.bubbleWrap, 
                  isSelf ? styles.bubbleSelf : styles.bubblePartner
                ]}
              >
                <Text style={[styles.bubbleText, isSelf ? styles.bubbleTextSelf : styles.bubbleTextPartner]}>
                  {msg.body}
                </Text>
                <Text style={[styles.msgTime, isSelf ? styles.msgTimeSelf : styles.msgTimePartner]}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* 4. BOTTOM INPUT PANEL */}
        <View style={[styles.bottomPanelWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.inputOuter}>
            <TextInput 
              style={styles.input} 
              placeholder="Send message…" 
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={handleSend}
            />
            <Pressable 
              style={[
                styles.sendBtn, 
                message.trim().length > 0 ? styles.sendBtnActive : null
              ]} 
              onPress={handleSend}
            >
              <Text style={[
                styles.sendIcon,
                message.trim().length > 0 ? styles.sendIconActive : null
              ]}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* RIDING LOCK OVERLAY */}
      {isRiding && (
        <View style={styles.lockOverlayWrap}>
          <BlurView intensity={30} tint="dark" style={styles.lockOverlayBlur}>
            <Text style={styles.lockTitle}>SAFETY LOCK ACTIVE</Text>
            <Text style={styles.lockSub}>Messaging locked while riding</Text>
          </BlurView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0c0e',
  },
  
  headerWrap: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBlur: { 
    paddingBottom: 10,
  },
  headerInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingHorizontal: 16, 
    paddingTop: 6,
  },
  backBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  backIcon: { 
    fontFamily: 'Archivo_600SemiBold', 
    fontSize: 22, 
    color: '#fff', 
    marginBottom: 2,
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(99,255,77,0.4)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarText: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 13, 
    color: colors.speedGreen,
  },
  headerInfo: { 
    flex: 1,
  },
  nameText: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 14, 
    color: '#fff',
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 2,
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: colors.speedGreen,
  },
  statusText: { 
    fontFamily: 'JetBrainsMono_500Medium', 
    fontSize: 10, 
    color: 'rgba(255,255,255,0.4)', 
    letterSpacing: 0.8,
  },

  // MEETUP ACTION BARS
  meetupActionsBarWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9,
  },
  quickMeetupRow: {
    flexDirection: 'row',
    gap: 10,
  },
  meetupBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.35)',
    backgroundColor: 'rgba(10,14,12,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupBtnSecondary: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  meetupBtnText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: colors.speedGreen,
    letterSpacing: 0.6,
  },

  // PROPOSAL CARD
  proposalCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.4)',
    padding: 14,
    gap: 8,
  },
  proposalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.speedGreen,
  },
  proposalTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
    flex: 1,
  },
  proposalSub: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  proposalActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  proposalAcceptBtn: {
    flex: 2,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalAcceptText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#04120a',
    letterSpacing: 0.5,
  },
  proposalDeclineBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalDeclineText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },

  // WAITING CARD
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(12,14,18,0.9)',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  waitingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFCC00',
  },
  waitingText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: '#fff',
    flex: 1,
  },
  waitingCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  waitingCancelText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
  },

  // ACTIVE EN ROUTE CARD
  activeRouteCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.35)',
    padding: 14,
    gap: 6,
  },
  activeRouteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeRouteTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: colors.speedGreen,
    letterSpacing: 0.6,
  },
  activeRouteSub: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  activeRouteBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  viewRadarBtn: {
    flex: 2,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99,255,77,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewRadarBtnText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
    letterSpacing: 0.6,
  },
  cancelRouteBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRouteBtnText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
  },

  // CHAT SCROLL & BUBBLES
  chatScroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 24,
  },
  emptyTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 15,
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 18,
  },
  bubbleWrap: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 10,
  },
  bubbleSelf: {
    alignSelf: 'flex-end',
    backgroundColor: '#19281a',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    alignSelf: 'flex-start',
    backgroundColor: '#13151a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  bubbleTextSelf: {
    color: '#f0fff0',
  },
  bubbleTextPartner: {
    color: '#ffffff',
  },
  msgTime: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeSelf: {
    color: 'rgba(99,255,77,0.6)',
  },
  msgTimePartner: {
    color: 'rgba(255,255,255,0.35)',
  },

  // BOTTOM INPUT PANEL
  bottomPanelWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#070809',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: '#fff',
    paddingVertical: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: colors.speedGreen,
  },
  sendIcon: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
  },
  sendIconActive: {
    color: '#04120a',
  },

  // RIDING SAFETY LOCK
  lockOverlayWrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockOverlayBlur: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,45,70,0.4)',
    backgroundColor: 'rgba(15,10,12,0.9)',
  },
  lockTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    color: '#FF4D4D',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  lockSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});

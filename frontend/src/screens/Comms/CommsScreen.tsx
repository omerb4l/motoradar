import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/store/useAuthStore';
import { useRendezvousStore } from '@/store/useRendezvousStore';
import { useChatStore } from '@/store/useChatStore';
import { useSosStore } from '@/store/useSosStore';
import { useReminderStore } from '@/store/useReminderStore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

export function CommsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  
  const requests = useRendezvousStore((s) => s.requests);
  const fetchPending = useRendezvousStore((s) => s.fetchPending);
  const acceptRequest = useRendezvousStore((s) => s.acceptRequest);
  const declineRequest = useRendezvousStore((s) => s.declineRequest);

  const chats = useChatStore((s) => s.chats);
  const fetchChats = useChatStore((s) => s.fetchChats);
  
  const activeSosAlerts = useSosStore((s) => s.activeAlerts);
  const removeAlert = useSosStore((s) => s.removeAlert);

  const reminders = useReminderStore((s) => s.reminders);
  const fetchReminders = useReminderStore((s) => s.fetchReminders);

  useFocusEffect(
    useCallback(() => {
      fetchPending();
      fetchChats();
      if (token) fetchReminders(token);
    }, [fetchPending, fetchChats, fetchReminders, token])
  );

  const handleOpenProfile = (id?: string) => {
    navigation.navigate('UserProfile', { userId: id || user?.id || '' });
  };

  const urgentReminders = reminders.filter((r) => r.status !== 'SAFE');
  const pendingIncomingCount = requests.filter(r => r.recipientId === user?.id && r.status === 'PENDING').length;
  const totalActive = pendingIncomingCount + chats.length + urgentReminders.length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0c0e', '#070809']} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>COMMS</Text>
              <Text style={styles.subtitle}>RIDER DIRECT NETWORK</Text>
            </View>
            {totalActive > 0 && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{totalActive} ACTIVE</Text>
              </View>
            )}
          </View>

          {/* ACTIVE SOS ALERTS (Real-time only) */}
          {activeSosAlerts.map((alert) => (
            <View key={alert.id} style={styles.sosCardWrap}>
              <BlurView intensity={30} tint="dark" style={styles.sosBlur}>
                <LinearGradient colors={['rgba(255,45,70,0.18)', 'rgba(255,45,70,0.06)']} style={StyleSheet.absoluteFill} />
                <View style={styles.sosRow}>
                  <View style={styles.sosDot} />
                  <Text style={styles.sosTitle}>
                    {alert.alertType === 'AUTO_CRASH' ? 'CRASH DETECTED' : 'EMERGENCY SOS'}
                  </Text>
                  <Text style={styles.sosTime}>LIVE</Text>
                </View>
                <Text style={styles.sosName}>{alert.username.toUpperCase()}</Text>
                <Text style={styles.sosLocation}>Emergency beacon broadcasted nearby</Text>
                
                <View style={styles.sosActions}>
                  <Pressable style={styles.dismissBtn} onPress={() => removeAlert(alert.id)}>
                    <Text style={styles.dismissBtnText}>DISMISS</Text>
                  </Pressable>
                </View>
              </BlurView>
            </View>
          ))}

          {/* URGENT REMINDERS (TÜVTÜRK & INSURANCE) */}
          {urgentReminders.map((r) => {
            const isExpired = r.status === 'EXPIRED';
            const daysText = isExpired
              ? `${Math.abs(r.daysRemaining)} DAYS OVERDUE`
              : r.daysRemaining === 0
              ? 'EXPIRES TODAY'
              : `${r.daysRemaining} DAYS REMAINING`;

            const dateParts = r.expiryDate.split('-');
            const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : r.expiryDate;

            return (
              <Pressable 
                key={r.id} 
                style={[styles.reminderAlertWrap, isExpired ? styles.reminderAlertExpired : styles.reminderAlertWarning]} 
                onPress={() => navigation.navigate('MotoReminders')}
              >
                <BlurView intensity={30} tint="dark" style={styles.reminderAlertBlur}>
                  <LinearGradient 
                    colors={isExpired ? ['rgba(255,45,70,0.18)', 'rgba(255,45,70,0.05)'] : ['rgba(255,204,0,0.18)', 'rgba(255,204,0,0.05)']} 
                    style={StyleSheet.absoluteFill} 
                  />
                  <View style={styles.reminderAlertHeader}>
                    <View style={styles.alertTagPill}>
                      <Text style={[styles.alertTagPillText, { color: isExpired ? '#FF6070' : '#FFD60A' }]}>
                        {isExpired ? 'OVERDUE LEGAL NOTICE' : 'LEGAL REMINDER'}
                      </Text>
                    </View>
                    <Text style={[styles.reminderAlertDays, { color: isExpired ? '#FF4D4D' : '#FFCC00' }]}>
                      {daysText}
                    </Text>
                  </View>
                  <Text style={styles.reminderAlertName}>{r.title}</Text>
                  <Text style={styles.reminderAlertSub}>
                    Expiration: {dateFormatted} · {isExpired ? 'Vehicle must be renewed to remain road legal.' : 'Renewal date is approaching.'}
                  </Text>
                </BlurView>
              </Pressable>
            );
          })}

          {/* SECTION: RIDE REQUESTS */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RIDE REQUESTS</Text>
            {requests.length > 0 && <Text style={styles.sectionCount}>{requests.length}</Text>}
          </View>

          {requests.map((item) => {
            const isSentByMe = item.requesterId === user?.id;
            const displayName = isSentByMe ? item.recipientName : item.requesterName;
            
            return (
              <View key={item.id} style={styles.itemCardWrap}>
                <BlurView intensity={24} tint="dark" style={styles.itemBlur}>
                  <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.itemRow}>
                    <Pressable 
                      style={styles.avatar} 
                      onPress={() => handleOpenProfile(isSentByMe ? item.recipientId : item.requesterId)}
                    >
                      <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || 'R'}</Text>
                    </Pressable>
                    <Pressable 
                      style={styles.itemInfo} 
                      onPress={() => handleOpenProfile(isSentByMe ? item.recipientId : item.requesterId)}
                    >
                      <Text style={styles.itemName}>{displayName || 'Rider'}</Text>
                      <Text style={styles.itemDesc}>
                        {isSentByMe ? 'You sent a ride request' : 'Wants to ride together'}
                      </Text>
                    </Pressable>

                    <View style={[
                      styles.statusPill,
                      item.status === 'ACCEPTED' ? styles.statusPillAccepted :
                      item.status === 'DECLINED' ? styles.statusPillDeclined : styles.statusPillPending
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        item.status === 'ACCEPTED' ? { color: colors.speedGreen } :
                        item.status === 'DECLINED' ? { color: '#FF4D4D' } : { color: 'rgba(255,255,255,0.7)' }
                      ]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {!isSentByMe && item.status === 'PENDING' && (
                    <View style={styles.itemActionRow}>
                      <Pressable 
                        style={[styles.reqActionBtn, styles.reqActionBtnAccept]} 
                        onPress={() => acceptRequest(item.id)}
                      >
                        <Text style={styles.reqActionTextAccept}>ACCEPT</Text>
                      </Pressable>
                      <Pressable 
                        style={[styles.reqActionBtn, styles.reqActionBtnDecline]} 
                        onPress={() => declineRequest(item.id)}
                      >
                        <Text style={styles.reqActionTextDecline}>DECLINE</Text>
                      </Pressable>
                    </View>
                  )}

                  {item.status === 'ACCEPTED' && (
                    <View style={styles.itemActionRow}>
                      <Pressable 
                        style={[styles.reqActionBtn, styles.reqActionBtnAccept, { flex: 1 }]} 
                        onPress={async () => {
                          await fetchChats();
                          const currentChats = useChatStore.getState().chats;
                          const partnerId = isSentByMe ? item.recipientId : item.requesterId;
                          const partnerName = isSentByMe ? item.recipientName : item.requesterName;
                          const targetChat = currentChats.find(c => c.partner_id === partnerId);
                          
                          useRendezvousStore.getState().removeRequest(item.id);
                          if (targetChat) {
                            navigation.navigate('Chat', {
                              chatId: targetChat.id,
                              partnerName: targetChat.partner_name || partnerName || 'Rider',
                              partnerId: targetChat.partner_id || partnerId || '',
                            });
                          }
                        }}
                      >
                        <Text style={styles.reqActionTextAccept}>OPEN DIRECT CHAT 💬</Text>
                      </Pressable>
                    </View>
                  )}
                </BlurView>
              </View>
            );
          })}
          
          {requests.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No pending ride requests</Text>
              <Text style={styles.emptySub}>Select a nearby rider on the Radar to send a meetup request</Text>
            </View>
          )}

          {/* SECTION: DIRECT CHATS */}
          <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>DIRECT MESSAGES</Text>
            {chats.length > 0 && <Text style={styles.sectionCount}>{chats.length}</Text>}
          </View>
          
          {chats.map((chat) => (
            <Pressable 
              key={chat.id} 
              style={styles.channelCard} 
              onPress={() => navigation.navigate('Chat', { 
                chatId: chat.id, 
                partnerName: chat.partner_name, 
                partnerId: chat.partner_id 
              })}
            >
              <View style={styles.channelAvatar}>
                <Text style={styles.avatarText}>{chat.partner_name ? chat.partner_name.slice(0, 2).toUpperCase() : 'MR'}</Text>
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelHeaderRow}>
                  <Text style={styles.channelName}>{chat.partner_name || 'Rider'}</Text>
                  {chat.last_message_at && (
                    <Text style={styles.channelTime}>
                      {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Text style={styles.channelPreview} numberOfLines={1}>
                  {chat.last_message || 'Tap to start conversation...'}
                </Text>
              </View>
            </Pressable>
          ))}
          
          {chats.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active conversations</Text>
              <Text style={styles.emptySub}>Direct channels are opened when ride requests are accepted</Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0c0e',
  },
  content: { 
    paddingHorizontal: 18, 
    paddingTop: 16, 
    paddingBottom: 120,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  title: { 
    fontFamily: 'Archivo_800ExtraBold', 
    fontSize: 28, 
    letterSpacing: -0.5, 
    color: '#fff',
  },
  subtitle: { 
    fontFamily: 'JetBrainsMono_500Medium', 
    fontSize: 10, 
    letterSpacing: 1.2, 
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
  },
  activePillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
    letterSpacing: 0.8,
  },
  
  sosCardWrap: {
    borderRadius: 18, 
    overflow: 'hidden',
    borderWidth: 1, 
    borderColor: 'rgba(255,45,70,0.4)',
    marginBottom: 20,
  },

  // Urgent Reminder Banner Styles
  reminderAlertWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  reminderAlertWarning: {
    borderColor: 'rgba(255,204,0,0.4)',
  },
  reminderAlertExpired: {
    borderColor: 'rgba(255,45,70,0.5)',
  },
  reminderAlertBlur: { padding: 14 },
  reminderAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  alertTagPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertTagPillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  reminderAlertDays: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  reminderAlertName: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 15,
    color: '#fff',
    marginTop: 4,
  },
  reminderAlertSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    lineHeight: 14,
  },
  sosBlur: { 
    padding: 16,
  },
  sosRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },
  sosDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#FF2D46',
  },
  sosTitle: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 11, 
    letterSpacing: 1.2, 
    color: '#FF6070',
  },
  sosTime: { 
    fontFamily: 'JetBrainsMono_500Medium', 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.4)', 
    marginLeft: 'auto',
  },
  sosName: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 20, 
    color: '#fff', 
    marginTop: 8,
  },
  sosLocation: { 
    fontFamily: 'Archivo_400Regular', 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.6)', 
    marginTop: 4,
  },
  sosActions: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 14,
  },
  dismissBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dismissBtnText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: { 
    fontFamily: 'JetBrainsMono_600SemiBold', 
    fontSize: 11, 
    letterSpacing: 1.5, 
    color: 'rgba(255,255,255,0.45)',
  },
  sectionCount: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
  },

  itemCardWrap: {
    borderRadius: 18, 
    overflow: 'hidden', 
    marginBottom: 10,
    backgroundColor: 'rgba(15,18,22,0.6)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemBlur: { 
    padding: 14,
  },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.16)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarText: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 14, 
    color: '#fff',
  },
  itemInfo: { 
    flex: 1,
  },
  itemName: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 16, 
    color: '#fff',
  },
  itemDesc: { 
    fontFamily: 'Archivo_400Regular', 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.5)', 
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillPending: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusPillAccepted: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderColor: 'rgba(99,255,77,0.3)',
  },
  statusPillDeclined: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.3)',
  },
  statusPillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  itemActionRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  reqActionBtn: { 
    flex: 1, 
    height: 36, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
  },
  reqActionBtnAccept: { 
    backgroundColor: colors.speedGreen,
  },
  reqActionBtnDecline: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reqActionTextAccept: { 
    fontFamily: 'JetBrainsMono_700Bold', 
    fontSize: 12, 
    color: '#04120a',
  },
  reqActionTextDecline: { 
    fontFamily: 'JetBrainsMono_500Medium', 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.6)',
  },

  emptyCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,18,22,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },

  channelCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 14, 
    borderRadius: 18, 
    marginBottom: 10, 
    backgroundColor: 'rgba(15,18,22,0.6)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
  },
  channelAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.16)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  channelInfo: { 
    flex: 1,
  },
  channelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  channelName: { 
    fontFamily: 'Archivo_700Bold', 
    fontSize: 15, 
    color: '#fff',
  },
  channelTime: { 
    fontFamily: 'JetBrainsMono_400Regular', 
    fontSize: 10, 
    color: 'rgba(255,255,255,0.35)',
  },
  channelPreview: { 
    fontFamily: 'Archivo_400Regular', 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.5)',
  },
});

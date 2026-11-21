import { VehicleReminder } from '../api/reminderApi';

export function checkAndLogReminderAlerts(reminders: VehicleReminder[]) {
  const urgent = reminders.filter((r) => r.status !== 'SAFE');
  if (urgent.length > 0) {
    urgent.forEach((r) => {
      let message = '';
      if (r.status === 'EXPIRED') {
        message = `🚨 DİKKAT: ${r.title} süresi doldu! Trafik cezası ve bağlanma riski!`;
      } else if (r.status === 'WARNING_1D') {
        message = `⚠️ SON GÜN: ${r.title} yarın sona eriyor!`;
      } else if (r.status === 'WARNING_3D') {
        message = `⚠️ DİKKAT: ${r.title} bitimine 3 gün kaldı!`;
      } else if (r.status === 'WARNING_7D') {
        message = `📅 HATIRLATMA: ${r.title} 1 hafta içinde yenilenmeli (${r.daysRemaining} gün kaldı).`;
      } else if (r.status === 'WARNING_30D') {
        message = `📅 BİLGİ: ${r.title} yenilemesine 1 ay kaldı (${r.daysRemaining} gün).`;
      }
      console.log(`[Reminder Notification]: ${message}`);
    });
  }
}

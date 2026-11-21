export type TabParamList = {
  Radar: undefined;
  Comms: undefined;
  Garage: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Settings: undefined;
  Verify: undefined;
  Chat: {
    chatId: string;
    partnerName?: string;
    partnerId?: string;
  };
  UserProfile: { userId: string };
  FuelLog: undefined;
  MotoAlbum: undefined;
  MotorcycleHistory: undefined;
  MotoReminders: undefined;
  RideSummary: {
    rideId?: string;
    summaryData?: import('@/services/api/rideApi').CreateRidePayload;
  } | undefined;
};

// expo-notifications is not supported on web — no-op implementations
export const requestNotificationPermission = async (): Promise<boolean> => false;
export const scheduleAllNotifications = async (_tasks: any[], _events: any[]): Promise<void> => {};

// Vibration is meaningless in a screenshot; the calls must simply not throw.
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as const;
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' } as const;
export async function impactAsync(_style?: unknown): Promise<void> {}
export async function notificationAsync(_type?: unknown): Promise<void> {}
export async function selectionAsync(): Promise<void> {}

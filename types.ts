
export type MessageSender = 'bot' | 'user';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  type?: 'text' | 'date-picker' | 'location-picker' | 'summary';
}

export interface HearingData {
  preferredDate: string;
  location: string;
  locationDetails?: string;
}

export enum Step {
  GREETING = 'GREETING',
  SELECT_DATE = 'SELECT_DATE',
  SELECT_LOCATION = 'SELECT_LOCATION',
  CONFIRMATION = 'CONFIRMATION',
  COMPLETED = 'COMPLETED'
}

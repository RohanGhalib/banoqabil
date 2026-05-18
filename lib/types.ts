export interface Student {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  interviewed: 'Yes' | 'No';
  deposit: 'Yes' | 'No';
  batch1: 'Yes' | 'No';
  priority: number;
  status: string;
  enrolled: boolean;
  
  // Assigned Slot (Optional/Nullable)
  campusId?: string | null;
  roomId?: string | null;
  slotKey?: string | null;
  courseCode?: string | null;
  createdAt?: any;
}

export interface SlotRosterItem {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  priority: number;
  status: string;
}

export interface Slot {
  id: string;
  campusId: string;
  roomId: string;
  slotKey: string;
  course: string; // 'GD', 'VE', 'CS', 'WD', 'AiE', 'DM'
  gender: 'M' | 'F' | 'M+F';
  capacity: number;
  
  // Dynamic Aggregations from DB
  enrolledCount?: number;
  maleCount?: number;
  femaleCount?: number;
  roster?: SlotRosterItem[];
}

export const COURSE_NAMES: Record<string, string> = {
  'GD': 'Graphic Design',
  'VE': 'Video Editing',
  'CS': 'Cyber Security',
  'WD': 'Web Development',
  'AiE': 'AI Essentials',
  'DM': 'Digital Marketing'
};

export const PRIORITY_NAMES: Record<number, string> = {
  1: 'P1 - Ready',
  2: 'P2 - Interviewed & Deposit',
  3: 'P3 - Test Passed',
  4: 'P4 - Registered'
};

export const PRIORITY_BADGES: Record<number, string> = {
  1: 'p1-badge',
  2: 'p2-badge',
  3: 'p3-badge',
  4: 'p4-badge'
};

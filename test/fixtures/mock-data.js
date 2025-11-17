/**
 * Mock data for testing
 * Based on actual data structures from the application
 */

/**
 * Mock user data
 * @type {import('../../types/core/user').User}
 */
export const mockUser = {
  phone: '09012345678',
  studentId: 'STU001',
  name: 'テスト太郎',
  furigana: 'テストタロウ',
  grade: '中学3年生',
  school: 'テスト中学校',
  email: 'test@example.com',
  parentPhone: '09087654321',
  address: '東京都テスト区テスト町1-2-3',
  registrationDate: '2024-01-15',
  notes: '',
};

/**
 * Mock lesson data
 * @type {import('../../types/core/lesson').Lesson[]}
 */
export const mockLessons = [
  {
    lessonId: 'LESSON001',
    date: '2025-12-01',
    startTime: '14:00',
    endTime: '15:00',
    teacherName: '山田先生',
    subject: '数学',
    capacity: 5,
    currentReservations: 2,
    status: 'open',
    notes: '',
  },
  {
    lessonId: 'LESSON002',
    date: '2025-12-01',
    startTime: '15:00',
    endTime: '16:00',
    teacherName: '佐藤先生',
    subject: '英語',
    capacity: 5,
    currentReservations: 5,
    status: 'full',
    notes: '',
  },
  {
    lessonId: 'LESSON003',
    date: '2025-12-02',
    startTime: '14:00',
    endTime: '15:00',
    teacherName: '山田先生',
    subject: '数学',
    capacity: 5,
    currentReservations: 0,
    status: 'open',
    notes: '',
  },
];

/**
 * Mock reservation data
 * @type {import('../../types/core/reservation').Reservation[]}
 */
export const mockReservations = [
  {
    reservationId: 'RES001',
    lessonId: 'LESSON001',
    studentId: 'STU001',
    studentName: 'テスト太郎',
    phone: '09012345678',
    date: '2025-12-01',
    startTime: '14:00',
    endTime: '15:00',
    subject: '数学',
    teacherName: '山田先生',
    status: 'confirmed',
    createdAt: '2024-11-15T10:00:00Z',
    notes: '',
  },
];

/**
 * Mock accounting master data
 * @type {import('../../types/core/accounting').AccountingMaster[]}
 */
export const mockAccountingMaster = [
  {
    accountingId: 'ACC001',
    studentId: 'STU001',
    studentName: 'テスト太郎',
    phone: '09012345678',
    yearMonth: '2024-11',
    totalAmount: 20000,
    paidAmount: 20000,
    unpaidAmount: 0,
    status: 'paid',
    paymentDate: '2024-11-30',
    notes: '',
  },
  {
    accountingId: 'ACC002',
    studentId: 'STU001',
    studentName: 'テスト太郎',
    phone: '09012345678',
    yearMonth: '2024-12',
    totalAmount: 25000,
    paidAmount: 0,
    unpaidAmount: 25000,
    status: 'unpaid',
    paymentDate: null,
    notes: '',
  },
];

/**
 * Mock cache versions
 */
export const mockCacheVersions = {
  reservations: '2024-11-17-001',
  lessons: '2024-11-17-001',
  accountingMaster: '2024-11-17-001',
  accountingDetails: '2024-11-17-001',
};

/**
 * Mock available slots data
 */
export const mockAvailableSlots = [
  {
    date: '2025-12-01',
    slots: [
      {
        startTime: '14:00',
        endTime: '15:00',
        available: true,
        capacity: 5,
        currentReservations: 2,
      },
      {
        startTime: '15:00',
        endTime: '16:00',
        available: false,
        capacity: 5,
        currentReservations: 5,
      },
    ],
  },
  {
    date: '2025-12-02',
    slots: [
      {
        startTime: '14:00',
        endTime: '15:00',
        available: true,
        capacity: 5,
        currentReservations: 0,
      },
    ],
  },
];

/**
 * Helper function to clone mock data (to avoid mutations)
 */
export function cloneMockData(data) {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Generate mock response in standard API format
 */
export function createMockResponse(success, data, message = null) {
  return {
    success,
    data: {
      ...data,
      ...(message && { message }),
    },
  };
}

/**
 * Generate mock authentication response
 */
export function createMockAuthResponse(userFound, user = null) {
  if (!userFound) {
    return {
      success: false,
      userFound: false,
      user: null,
      data: {},
    };
  }

  return {
    success: true,
    userFound: true,
    user: cloneMockData(user || mockUser),
    data: {
      accountingMaster: cloneMockData(mockAccountingMaster),
      lessons: cloneMockData(mockLessons),
      myReservations: cloneMockData(mockReservations),
      cacheVersions: cloneMockData(mockCacheVersions),
    },
  };
}

/**
 * Mock backend handlers
 * Emulates the backend endpoints from 09_Backend_Endpoints.js
 */

import {
  mockUser,
  mockLessons,
  mockReservations,
  mockAccountingMaster,
  mockCacheVersions,
  mockAvailableSlots,
  cloneMockData,
  createMockResponse,
  createMockAuthResponse,
} from '../fixtures/mock-data.js';

// In-memory storage for testing
let storage = {
  users: new Map([[mockUser.phone, mockUser]]),
  reservations: [...mockReservations],
  lessons: [...mockLessons],
  accountingMaster: [...mockAccountingMaster],
};

/**
 * Mock backend handlers matching actual API endpoints
 */
export const mockBackendHandlers = {
  /**
   * Get login data
   * @param {string} phone
   * @returns {Promise<Object>}
   */
  getLoginData: async (phone) => {
    // Normalize phone number
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    // Find user
    const user = storage.users.get(normalizedPhone);

    if (!user) {
      return createMockAuthResponse(false);
    }

    // Get user's reservations
    const userReservations = storage.reservations.filter(
      (r) => r.phone === normalizedPhone
    );

    return createMockAuthResponse(true, user);
  },

  /**
   * Get registration data (for new user registration)
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  getRegistrationData: async (userData) => {
    const normalizedPhone = userData.phone.replace(/[^0-9]/g, '');

    // Check if user already exists
    if (storage.users.has(normalizedPhone)) {
      return createMockResponse(false, {}, 'この電話番号は既に登録されています');
    }

    // Create new user
    const newUser = {
      ...userData,
      phone: normalizedPhone,
      studentId: `STU${Date.now()}`,
      registrationDate: new Date().toISOString().split('T')[0],
    };

    storage.users.set(normalizedPhone, newUser);

    return createMockAuthResponse(true, newUser);
  },

  /**
   * Make a reservation
   * @param {Object} reservationInfo
   * @returns {Promise<Object>}
   */
  makeReservationAndGetLatestData: async (reservationInfo) => {
    const { lessonId, phone, studentId } = reservationInfo;

    // Find lesson
    const lesson = storage.lessons.find((l) => l.lessonId === lessonId);

    if (!lesson) {
      return createMockResponse(false, {}, 'レッスンが見つかりません');
    }

    // Check capacity
    if (lesson.currentReservations >= lesson.capacity) {
      return createMockResponse(false, {}, 'このレッスンは満員です');
    }

    // Create reservation
    const newReservation = {
      reservationId: `RES${Date.now()}`,
      lessonId: lesson.lessonId,
      studentId,
      phone: phone.replace(/[^0-9]/g, ''),
      date: lesson.date,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      subject: lesson.subject,
      teacherName: lesson.teacherName,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      notes: '',
    };

    storage.reservations.push(newReservation);

    // Update lesson capacity
    lesson.currentReservations += 1;
    if (lesson.currentReservations >= lesson.capacity) {
      lesson.status = 'full';
    }

    return createMockResponse(
      true,
      {
        myReservations: cloneMockData(
          storage.reservations.filter((r) => r.phone === newReservation.phone)
        ),
        lessons: cloneMockData(storage.lessons),
        cacheVersions: mockCacheVersions,
      },
      '予約が完了しました'
    );
  },

  /**
   * Cancel a reservation
   * @param {Object} cancelInfo
   * @returns {Promise<Object>}
   */
  cancelReservationAndGetLatestData: async (cancelInfo) => {
    const { reservationId, phone } = cancelInfo;

    // Find reservation
    const reservationIndex = storage.reservations.findIndex(
      (r) => r.reservationId === reservationId && r.phone === phone
    );

    if (reservationIndex === -1) {
      return createMockResponse(false, {}, '予約が見つかりません');
    }

    const reservation = storage.reservations[reservationIndex];

    // Update lesson capacity
    const lesson = storage.lessons.find(
      (l) => l.lessonId === reservation.lessonId
    );
    if (lesson) {
      lesson.currentReservations -= 1;
      lesson.status = 'open';
    }

    // Remove reservation
    storage.reservations.splice(reservationIndex, 1);

    return createMockResponse(
      true,
      {
        myReservations: cloneMockData(
          storage.reservations.filter((r) => r.phone === phone)
        ),
        lessons: cloneMockData(storage.lessons),
        cacheVersions: mockCacheVersions,
      },
      '予約をキャンセルしました'
    );
  },

  /**
   * Get batch data
   * @param {string[]} dataTypes
   * @param {string} phone
   * @param {string} studentId
   * @returns {Promise<Object>}
   */
  getBatchData: async (dataTypes, phone, studentId) => {
    const result = {
      success: true,
      data: {},
    };

    const normalizedPhone = phone?.replace(/[^0-9]/g, '');

    for (const dataType of dataTypes) {
      switch (dataType) {
        case 'lessons':
          result.data.lessons = cloneMockData(storage.lessons);
          break;
        case 'myReservations':
          if (normalizedPhone) {
            result.data.myReservations = cloneMockData(
              storage.reservations.filter((r) => r.phone === normalizedPhone)
            );
          }
          break;
        case 'accountingMaster':
          if (studentId) {
            result.data.accountingMaster = cloneMockData(
              storage.accountingMaster.filter((a) => a.studentId === studentId)
            );
          }
          break;
        case 'availableSlots':
          result.data.availableSlots = cloneMockData(mockAvailableSlots);
          break;
      }
    }

    return result;
  },

  /**
   * Get cache versions
   * @returns {Promise<Object>}
   */
  getCacheVersions: async () => {
    return createMockResponse(true, {
      cacheVersions: cloneMockData(mockCacheVersions),
    });
  },

  /**
   * Update profile
   * @param {Object} profileData
   * @returns {Promise<Object>}
   */
  updateProfile: async (profileData) => {
    const normalizedPhone = profileData.phone.replace(/[^0-9]/g, '');
    const user = storage.users.get(normalizedPhone);

    if (!user) {
      return createMockResponse(false, {}, 'ユーザーが見つかりません');
    }

    // Update user data
    Object.assign(user, profileData, { phone: normalizedPhone });

    return createMockResponse(
      true,
      {
        user: cloneMockData(user),
      },
      'プロフィールを更新しました'
    );
  },
};

/**
 * Reset storage to initial state (for testing)
 */
export function resetMockStorage() {
  storage = {
    users: new Map([[mockUser.phone, cloneMockData(mockUser)]]),
    reservations: cloneMockData(mockReservations),
    lessons: cloneMockData(mockLessons),
    accountingMaster: cloneMockData(mockAccountingMaster),
  };
}

/**
 * Get current storage state (for testing assertions)
 */
export function getMockStorage() {
  return {
    users: Array.from(storage.users.values()),
    reservations: cloneMockData(storage.reservations),
    lessons: cloneMockData(storage.lessons),
    accountingMaster: cloneMockData(storage.accountingMaster),
  };
}

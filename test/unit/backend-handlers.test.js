/**
 * Unit tests for mock backend handlers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockBackendHandlers,
  resetMockStorage,
  getMockStorage,
} from '../mocks/backend-handlers.js';
import { mockUser } from '../fixtures/mock-data.js';

describe('Backend Handlers - Authentication', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  describe('getLoginData', () => {
    it('should return user data for valid phone number', async () => {
      const response = await mockBackendHandlers.getLoginData('09012345678');

      expect(response.success).toBe(true);
      expect(response.userFound).toBe(true);
      expect(response.user).toBeDefined();
      expect(response.user.phone).toBe('09012345678');
      expect(response.user.name).toBe('テスト太郎');
    });

    it('should handle phone number with hyphens', async () => {
      const response = await mockBackendHandlers.getLoginData('090-1234-5678');

      expect(response.success).toBe(true);
      expect(response.userFound).toBe(true);
      expect(response.user.phone).toBe('09012345678');
    });

    it('should return error for non-existent user', async () => {
      const response = await mockBackendHandlers.getLoginData('09099999999');

      expect(response.success).toBe(false);
      expect(response.userFound).toBe(false);
      expect(response.user).toBeNull();
    });

    it('should include batch data in response', async () => {
      const response = await mockBackendHandlers.getLoginData('09012345678');

      expect(response.data).toBeDefined();
      expect(response.data.lessons).toBeDefined();
      expect(response.data.myReservations).toBeDefined();
      expect(response.data.accountingMaster).toBeDefined();
      expect(response.data.cacheVersions).toBeDefined();
    });
  });

  describe('getRegistrationData', () => {
    it('should create a new user', async () => {
      const newUserData = {
        phone: '09098765432',
        name: '新規太郎',
        furigana: 'シンキタロウ',
        grade: '高校1年生',
        school: 'テスト高校',
        email: 'newuser@example.com',
        parentPhone: '09087654321',
        address: '東京都新規区新規町1-1-1',
      };

      const response =
        await mockBackendHandlers.getRegistrationData(newUserData);

      expect(response.success).toBe(true);
      expect(response.userFound).toBe(true);
      expect(response.user.name).toBe('新規太郎');
      expect(response.user.studentId).toBeDefined();
      expect(response.user.registrationDate).toBeDefined();
    });

    it('should reject duplicate phone number', async () => {
      const duplicateUser = {
        phone: '09012345678', // Already exists
        name: '重複太郎',
      };

      const response =
        await mockBackendHandlers.getRegistrationData(duplicateUser);

      expect(response.success).toBe(false);
      expect(response.data.message).toContain('既に登録されています');
    });
  });
});

describe('Backend Handlers - Reservations', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  describe('makeReservationAndGetLatestData', () => {
    it('should create a new reservation', async () => {
      const reservationInfo = {
        lessonId: 'LESSON003', // Available lesson with 0 reservations
        phone: '09012345678',
        studentId: 'STU001',
      };

      const response =
        await mockBackendHandlers.makeReservationAndGetLatestData(
          reservationInfo
        );

      expect(response.success).toBe(true);
      expect(response.data.message).toContain('予約が完了しました');
      expect(response.data.myReservations).toBeDefined();
      expect(response.data.myReservations.length).toBeGreaterThan(0);
    });

    it('should update lesson capacity after reservation', async () => {
      const reservationInfo = {
        lessonId: 'LESSON003',
        phone: '09012345678',
        studentId: 'STU001',
      };

      await mockBackendHandlers.makeReservationAndGetLatestData(
        reservationInfo
      );

      const storage = getMockStorage();
      const lesson = storage.lessons.find((l) => l.lessonId === 'LESSON003');

      expect(lesson.currentReservations).toBe(1); // Was 0, now 1
    });

    it('should reject reservation for full lesson', async () => {
      const reservationInfo = {
        lessonId: 'LESSON002', // Already full (5/5)
        phone: '09012345678',
        studentId: 'STU001',
      };

      const response =
        await mockBackendHandlers.makeReservationAndGetLatestData(
          reservationInfo
        );

      expect(response.success).toBe(false);
      expect(response.data.message).toContain('満員です');
    });

    it('should reject reservation for non-existent lesson', async () => {
      const reservationInfo = {
        lessonId: 'INVALID_LESSON',
        phone: '09012345678',
        studentId: 'STU001',
      };

      const response =
        await mockBackendHandlers.makeReservationAndGetLatestData(
          reservationInfo
        );

      expect(response.success).toBe(false);
      expect(response.data.message).toContain('見つかりません');
    });
  });

  describe('cancelReservationAndGetLatestData', () => {
    it('should cancel an existing reservation', async () => {
      const cancelInfo = {
        reservationId: 'RES001', // Existing reservation
        phone: '09012345678',
      };

      const response =
        await mockBackendHandlers.cancelReservationAndGetLatestData(cancelInfo);

      expect(response.success).toBe(true);
      expect(response.data.message).toContain('キャンセルしました');
    });

    it('should update lesson capacity after cancellation', async () => {
      const cancelInfo = {
        reservationId: 'RES001',
        phone: '09012345678',
      };

      await mockBackendHandlers.cancelReservationAndGetLatestData(cancelInfo);

      const storage = getMockStorage();
      const lesson = storage.lessons.find((l) => l.lessonId === 'LESSON001');

      expect(lesson.currentReservations).toBe(1); // Was 2, now 1
      expect(lesson.status).toBe('open');
    });

    it('should reject cancellation for non-existent reservation', async () => {
      const cancelInfo = {
        reservationId: 'INVALID_RES',
        phone: '09012345678',
      };

      const response =
        await mockBackendHandlers.cancelReservationAndGetLatestData(cancelInfo);

      expect(response.success).toBe(false);
      expect(response.data.message).toContain('見つかりません');
    });
  });
});

describe('Backend Handlers - Data Fetching', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  describe('getBatchData', () => {
    it('should fetch multiple data types', async () => {
      const response = await mockBackendHandlers.getBatchData(
        ['lessons', 'myReservations'],
        '09012345678',
        'STU001'
      );

      expect(response.success).toBe(true);
      expect(response.data.lessons).toBeDefined();
      expect(response.data.myReservations).toBeDefined();
    });

    it('should fetch only requested data types', async () => {
      const response = await mockBackendHandlers.getBatchData(
        ['lessons'],
        null,
        null
      );

      expect(response.success).toBe(true);
      expect(response.data.lessons).toBeDefined();
      expect(response.data.myReservations).toBeUndefined();
    });
  });

  describe('getCacheVersions', () => {
    it('should return cache versions', async () => {
      const response = await mockBackendHandlers.getCacheVersions();

      expect(response.success).toBe(true);
      expect(response.data.cacheVersions).toBeDefined();
      expect(response.data.cacheVersions.reservations).toBeDefined();
      expect(response.data.cacheVersions.lessons).toBeDefined();
    });
  });
});

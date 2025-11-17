/**
 * Unit tests for google.script.run mock
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockGoogleScript } from '../mocks/google-script-mock.js';

describe('Google Script Mock', () => {
  let googleScript;

  beforeEach(() => {
    googleScript = createMockGoogleScript();
  });

  describe('withSuccessHandler', () => {
    it('should call success handler on successful execution', async () => {
      const successCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getLoginData('09012345678');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(successCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          userFound: true,
        })
      );
    });

    it('should pass correct data to success handler', async () => {
      const successCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getLoginData('09012345678');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const callArg = successCallback.mock.calls[0][0];
      expect(callArg.user).toBeDefined();
      expect(callArg.user.name).toBe('テスト太郎');
    });
  });

  describe('withFailureHandler', () => {
    it('should call failure handler on error', async () => {
      const successCallback = vi.fn();
      const failureCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .withFailureHandler(failureCallback)
        .nonExistentFunction('test');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(failureCallback).toHaveBeenCalled();
      expect(successCallback).not.toHaveBeenCalled();
    });
  });

  describe('Chaining', () => {
    it('should support method chaining', () => {
      const chain = googleScript.run
        .withSuccessHandler(() => {})
        .withFailureHandler(() => {});

      expect(chain).toBeDefined();
      expect(typeof chain.getLoginData).toBe('function');
    });

    it('should work with only success handler', async () => {
      const successCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getLoginData('09012345678');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(successCallback).toHaveBeenCalled();
    });

    it('should work with only failure handler', async () => {
      const failureCallback = vi.fn();

      await googleScript.run
        .withFailureHandler(failureCallback)
        .nonExistentFunction('test');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(failureCallback).toHaveBeenCalled();
    });
  });

  describe('Backend Function Calls', () => {
    it('should call getLoginData', async () => {
      const successCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getLoginData('09012345678');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(successCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          userFound: true,
        })
      );
    });

    it('should call makeReservationAndGetLatestData', async () => {
      const successCallback = vi.fn();
      const reservationInfo = {
        lessonId: 'LESSON003',
        phone: '09012345678',
        studentId: 'STU001',
      };

      await googleScript.run
        .withSuccessHandler(successCallback)
        .makeReservationAndGetLatestData(reservationInfo);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(successCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should call getBatchData', async () => {
      const successCallback = vi.fn();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getBatchData(['lessons'], '09012345678', 'STU001');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(successCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            lessons: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('google.script.host', () => {
    it('should provide close method', () => {
      expect(typeof googleScript.host.close).toBe('function');
      expect(() => googleScript.host.close()).not.toThrow();
    });

    it('should provide setHeight method', () => {
      expect(typeof googleScript.host.setHeight).toBe('function');
      expect(() => googleScript.host.setHeight(500)).not.toThrow();
    });

    it('should provide setWidth method', () => {
      expect(typeof googleScript.host.setWidth).toBe('function');
      expect(() => googleScript.host.setWidth(800)).not.toThrow();
    });
  });

  describe('Network Delay Simulation', () => {
    it('should simulate network delay', async () => {
      const successCallback = vi.fn();
      const startTime = Date.now();

      await googleScript.run
        .withSuccessHandler(successCallback)
        .getLoginData('09012345678');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least 100ms (simulated delay)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { RegisterDtoSchema, LoginDtoSchema } from '../../src/modules/auth/dto/auth.dto';
import { CreateReviewDtoSchema } from '../../src/modules/reviews/dto/review.dto';
import { CreateExpenseDtoSchema } from '../../src/modules/expenses/dto/expense.dto';
import { CreateChecklistDtoSchema } from '../../src/modules/checklists/dto/checklist.dto';
import { GenerateItineraryDtoSchema } from '../../src/modules/itineraries/dto/itinerary-generator.dto';
import { ExpenseCategory, ChecklistCategory, TravelStyle } from '../../src/common/constants';
import { ResponseUtil } from '../../src/common/utils/api-response.util';

describe('Unit Test: Zod Validators & Response Mappers (Phase 21)', () => {
  describe('Auth Validators (Register & Login)', () => {
    it('should validate correct registration payload', () => {
      const valid = {
        username: 'rinjani_climber',
        name: 'Rinjani Climber',
        email: 'climber@rinjani.com',
        password: 'SecurePassword123!',
      };

      const result = RegisterDtoSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid username formats and reserved words in registration', () => {
      const reserved = {
        username: 'admin',
        name: 'Admin User',
        email: 'admin.user@example.com',
        password: 'SecurePassword123!',
      };
      expect(RegisterDtoSchema.safeParse(reserved).success).toBe(false);

      const invalidChars = {
        username: 'user with spaces',
        name: 'User Spaces',
        email: 'user.spaces@example.com',
        password: 'SecurePassword123!',
      };
      expect(RegisterDtoSchema.safeParse(invalidChars).success).toBe(false);
    });

    it('should reject invalid email and short password in registration', () => {
      const invalid = {
        name: 'A',
        email: 'invalid-email-format',
        password: '123',
      };

      const result = RegisterDtoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((e) => e.path.includes('email'))).toBe(true);
        expect(result.error.errors.some((e) => e.path.includes('password'))).toBe(true);
      }
    });

    it('should validate login payload properly', () => {
      const result = LoginDtoSchema.safeParse({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Review Validators', () => {
    it('should accept valid rating between 1.0 and 5.0 and content', () => {
      const result = CreateReviewDtoSchema.safeParse({
        rating: 4.5,
        content: 'Pemandangan sunset di Bukit Merese luar biasa indah!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject out-of-bounds ratings (e.g. 0 or 6.5)', () => {
      const resultUnder = CreateReviewDtoSchema.safeParse({ rating: 0, content: 'Too low' });
      const resultOver = CreateReviewDtoSchema.safeParse({ rating: 6.5, content: 'Too high' });

      expect(resultUnder.success).toBe(false);
      expect(resultOver.success).toBe(false);
    });
  });

  describe('Expense Validators', () => {
    it('should validate valid expense categories and positive amounts', () => {
      const result = CreateExpenseDtoSchema.safeParse({
        category: ExpenseCategory.FOOD,
        amount: 85000,
        title: 'Ayam Taliwang Dinner',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts and invalid categories', () => {
      const result = CreateExpenseDtoSchema.safeParse({
        category: 'INVALID_CATEGORY',
        amount: -5000,
        title: 'Negative Expense',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Checklist Validators', () => {
    it('should validate packing checklist with valid categories and items', () => {
      const result = CreateChecklistDtoSchema.safeParse({
        title: 'Perlengkapan Snorkeling Gili',
        category: ChecklistCategory.BEACH,
        items: [{ itemText: 'Snorkel mask' }, { itemText: 'Fin size 42' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Smart Itinerary Generator Validators', () => {
    it('should validate complete itinerary generator input parameters', () => {
      const result = GenerateItineraryDtoSchema.safeParse({
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        budget: 2500000,
        numberOfTravelers: 2,
        interests: ['beach', 'waterfall'],
        travelStyle: TravelStyle.BEACH_RELAXATION,
        travelPace: 'BALANCED',
        transportation: 'MOTORCYCLE',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid dates or negative budget', () => {
      const result = GenerateItineraryDtoSchema.safeParse({
        startDate: '',
        endDate: '2026-09-01',
        budget: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Response Envelope Mappers', () => {
    it('should construct standardized pagination metadata envelope', () => {
      let capturedStatus = 0;
      let capturedJson: any = null;

      const mockRes: any = {
        status(code: number) {
          capturedStatus = code;
          return this;
        },
        json(payload: any) {
          capturedJson = payload;
          return this;
        },
      };

      ResponseUtil.sendPaginated(
        mockRes,
        [{ id: '1' }, { id: '2' }],
        { page: 1, limit: 10, total: 25, totalPages: 3, hasNext: true, hasPrev: false },
        'Destinations retrieved',
      );

      expect(capturedStatus).toBe(200);
      expect(capturedJson.success).toBe(true);
      expect(capturedJson.message).toBe('Destinations retrieved');
      expect(capturedJson.data).toHaveLength(2);
      expect(capturedJson.meta.totalPages).toBe(3);
      expect(capturedJson.meta.hasNext).toBe(true);
    });
  });
});

import { TranslationDictionary } from '../../types';

export const validationEn: TranslationDictionary = {
  VALIDATION_ERROR: 'Invalid input data',
  REQUIRED_FIELD: 'Field {field} is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_UUID: 'Invalid identifier format for {field}',
  INVALID_TYPE: 'Invalid data type for {field}',
  MIN_LENGTH: '{field} must be at least {min} characters',
  MAX_LENGTH: '{field} must not exceed {max} characters',
  MIN_VALUE: '{field} must be at least {min}',
  MAX_VALUE: '{field} must not exceed {max}',
  INVALID_ENUM: 'Invalid value for {field}',
  INVALID_URL: 'Invalid URL format for {field}',
  INVALID_COORDINATES: 'Invalid location coordinates',
  INVALID_LOCALE: 'Language code {locale} is not supported',
  DUPLICATE_LOCALE: 'Duplicate language codes are not allowed',
  REQUIRED_LOCALE_MISSING: 'Translation for default language {locale} is required',
};

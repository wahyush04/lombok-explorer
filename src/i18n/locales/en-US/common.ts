import { TranslationDictionary } from '../../types';

export const commonEn: TranslationDictionary = {
  // Generic success
  OPERATION_SUCCESS: 'Operation completed successfully',
  DATA_RETRIEVED: 'Data retrieved successfully',
  RESOURCE_CREATED: 'Resource created successfully',
  RESOURCE_UPDATED: 'Resource updated successfully',
  RESOURCE_DELETED: 'Resource deleted successfully',

  // Generic errors
  INTERNAL_SERVER_ERROR: 'Internal server error occurred',
  NOT_FOUND: 'The requested resource was not found',
  BAD_REQUEST: 'Invalid request',
  UNAUTHORIZED: 'Authentication is required to access this resource',
  FORBIDDEN: 'You do not have permission to perform this action',
  CONFLICT: 'A conflict occurred with the submitted data',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
  ROUTE_NOT_FOUND: 'Route {path} not found',
  INVALID_ID: 'Invalid ID format',
};

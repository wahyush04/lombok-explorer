import { Router, Request, Response } from 'express';
import { ResponseUtil } from '../../common/utils/api-response.util';

const router = Router();

/**
 * API Version 2 (v2) Router
 * Designed for non-breaking API evolution and next-generation features.
 * Features in v2 can introduce breaking schema changes without altering v1 contracts.
 */

// v2 Info & Status
router.get('/info', (_req: Request, res: Response) => {
  ResponseUtil.sendSuccess(
    res,
    {
      apiVersion: 'v2',
      status: 'active-preview',
      supportedVersions: ['v1', 'v2'],
      changelog:
        'API v2 architecture initialized for enhanced route optimization and ML recommendations.',
    },
    'Lombok Explorer API v2 Preview',
  );
});

// Future v2 module extensions will be mounted here:
// router.use('/destinations', destinationV2Routes);
// router.use('/itineraries', itineraryV2Routes);

export const v2Routes: Router = router;

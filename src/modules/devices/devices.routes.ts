import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { devicesController } from './devices.controller';
import { DeactivateDeviceTokenSchema, RegisterDeviceTokenSchema } from './dto/device.dto';

const router = Router();

router.post(
  '/fcm-token',
  authenticate,
  validate(RegisterDeviceTokenSchema),
  devicesController.registerToken,
);

router.delete(
  '/fcm-token',
  authenticate,
  validate(DeactivateDeviceTokenSchema),
  devicesController.deactivateToken,
);

export const deviceRoutes: Router = router;

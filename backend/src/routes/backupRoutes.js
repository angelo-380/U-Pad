import { Router } from 'express';
import { backupController } from '../controllers/backupController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Exclusivo para developer y admin
router.use(authenticate);
router.use(authorizeRoles('developer', 'admin'));

router.get('/', backupController.listar);
router.post('/', backupController.crear);

export default router;

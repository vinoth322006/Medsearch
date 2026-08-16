import { Router } from 'express';
import authRoutes from './auth.routes';
import searchRoutes from './search.routes';
import bookmarksRoutes from './bookmarks.routes';
import historyRoutes from './history.routes';
import adminRoutes from './admin.routes';

const router = Router();
router.use('/auth', authRoutes);
router.use('/', searchRoutes);      // /search + /health at root
router.use('/bookmarks', bookmarksRoutes);
router.use('/history', historyRoutes);
router.use('/admin', adminRoutes);

export default router;

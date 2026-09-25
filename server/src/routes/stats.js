/* v34: عدادات الواجهة الحية — الخدمات المنجزة من قاعدة البيانات + قيم يدوية من الأدمن */
const router = require('express').Router();
const { Order, SiteSettings } = require('../models');

router.get('/stats', async (req, res) => {
  try {
    const completed = await Order.countDocuments({ status: 'مكتمل' });
    const base = await SiteSettings.findOne({ key: 'statBaseCompleted' }).lean();
    const trainees = await SiteSettings.findOne({ key: 'statTrainees' }).lean();
    const support = await SiteSettings.findOne({ key: 'statSupport' }).lean();
    res.json({
      services: completed + (base && base.value ? parseInt(base.value) || 0 : 0),
      trainees: trainees && trainees.value ? parseInt(trainees.value) || 0 : 350,
      support: support && support.value ? support.value : '24',
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

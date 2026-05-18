const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/mcpController');

router.get('/context', ctrl.getContext);

module.exports = router;

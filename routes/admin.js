const path = require('path');

const express = require('express');

const { body } = require('express-validator/check')

const adminController = require('../controllers/admin');

const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get(
   '/add-product',
   isAuth,
   adminController.getAddProduct
);

router.get(
   '/products',
   isAuth,
   adminController.getProducts
);

router.post(
   '/add-product',
   [
      body('title', 'Enter a valid title.')
         .isString()
         .isLength({ min: 3, max: 100 })
         .trim(),
      body('price', 'Enter a valid price.')
         .isFloat({ gt: 0.0 }),
      body('description', 'Enter a valid description.')
         .isLength({ min: 5, max: 400 })
         .trim()
   ],
   isAuth,
   adminController.postAddProduct
);

router.get(
   '/edit-product/:productId',
   isAuth,
   adminController.getEditProduct
);

router.post(
   '/edit-product',
   [
      body('title', 'Enter a valid title.')
         .isString()
         .isLength({ min: 3, max: 100 })
         .trim(),
      body('price', 'Enter a valid price.')
         .isFloat({ gt: 0.0 }),
      body('description', 'Enter a valid description.')
         .isLength({ min: 5, max: 400 })
         .trim()
   ],
   isAuth,
   adminController.postEditProduct
);

router.delete(
   '/product/:productId',
   isAuth,
   adminController.deleteProduct
);

module.exports = router;

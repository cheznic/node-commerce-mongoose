const express = require('express');
const { check, body } = require('express-validator/check');

const authController = require('../controllers/auth');

const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post(
   '/login',
   [
      body('email')
         .isEmail()
         .withMessage('Invalid email or password.')
         .normalizeEmail(),
      body('password')
         .isLength({ min: 6 })
         .withMessage('Invalid email or password.')
         .trim()
   ],
   authController.postLogin
);

router.post(
   '/signup',
   [
      check('email')
         .isEmail()
         .withMessage('Please enter a valid email.')
         .normalizeEmail()
         .custom((value, { req }) => {
            // example of a 'black listed' domain
            if (value.includes('evil.com')) {
               throw new Error(`${value} is forbidden!`)
            }
            return true;
         })
         .custom((value, { req }) => {
            // Good example of an async validation (database lookup)
            return User.findOne({ email: value })
               .then(user => {
                  if (user) {
                     return Promise.reject(
                        `Email '${user.email.toString()}' is already used.`
                     );
                  }
               })
         }),
      body(
         'password',
         `Please enter a password with only numbers and letters and at least 6 characters`
      )
         .trim()
         .isLength({ min: 6 })
         .isAlphanumeric(),
      body('confirmPassword')
         .trim()
         .custom((value, { req }) => {
            if (value !== req.body.password) {
               throw new Error('Passwords must match.');
            }
            return true;
         })
   ],
   authController.postSignup);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;

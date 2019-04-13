const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodeMailer = require('nodemailer');
const sendGridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');

const User = require('../models/user');

const transporter = nodeMailer.createTransport(sendGridTransport({
  auth: {
    api_key: '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'
  }
}));

exports.getLogin = (req, res, next) => {
  let message = [...req.flash('error')];
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    previousInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = [...req.flash('error')];
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    previousInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      previousInput: {
        email: email,
        password: password
      },
      validationErrors: errors.array()
    });
  }
  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email or password.',
          previousInput: {
            email: email,
            password: password
          },
          validationErrors: []
        });
      }
      bcrypt
        .compare(password, user.password)
        .then(matching => {
          if (matching) {
            req.session.user = user;
            req.session.isLoggedIn = true;
            return req.session.save(err => {
              if (err) {
                console.error('Error:', err);
              }
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Invalid email or password.',
            previousInput: {
              email: email,
              password: password
            },
            validationErrors: []
          });
        })
        .catch(err => {
          // req.flash('error', 'System error. Please try again later.');
          console.error('System error:', err);
          return res.redirect('/login');
        });
    })
    .catch(err => {
      console.error('Error retrieving user during login.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      previousInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    });
  }

  bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      // create and save new user
      const newUser = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] }
      });
      return newUser.save();
    })
    .then(result => {
      // create and send signup confirmation
      res.redirect('/login');
      transporter.sendMail({
        to: email,
        from: 'shop@node-commerce.com',
        subject: 'Signup success!',
        html: '<h1>You are now signed up at Node Commerce!</h1>'
      })
    })
    .catch(err => {
      console.error('Error sending email.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error:', err);
    }
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = [...req.flash('error')];
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: message
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.error('Error, Auth/reset:', err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        if (!user) {
          req.flash('error', 'Email not found');
          return req.session.save(err => {
            if (err) {
              console.error('Error:', err);
            }
            return res.redirect('/reset');
          });
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user
          .save()
          .then(result => {
            res.redirect('/');
            transporter.sendMail({
              to: req.body.email,
              from: 'shop@test.com',
              subject: 'Password reset.',
              html: `<p>You requested a password reset.</p>
<p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set your new password.</p>
<p>If you did not request this email, simply delete it.</p>`
            })
          })
          .catch(err => {
            console.error('Error sending email on reset:', err)
          });
      })
      .catch(err => {
        console.error('Error retrieving user during password reset.', err);
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
    })
}

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() }
  })
    .then(user => {
      if (!user) {
        req.flash('error', 'Token expired, please request a new reset link.');
        return req.session.save(err => {
          if (err) {
            console.error('Error:', err);
          }
          return res.redirect('/reset');
        });
      }
      let message = [...req.flash('error')];
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        userId: user._id.toString(),
        passwordToken: token
      });
    })
    .catch(err => {
      console.error('Error retrieving token.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId
  })
    .then(user => {
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then(hashedPassword => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then(result => {
      // send notification that email has been changed
      res.redirect('/login');
    })
    .catch(err => {
      console.error('Error validating token:', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}
// initialize express
const express = require('express');
const app = express();

// initialize URL encoded form handler
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

// initialize multi-part form handler for file uploads
const multer = require('multer');
const nanoid = require('nanoid')
const filter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/gif') {
    cb(null, true);
  } else {
    cb(null, false);
  }
}
const fileStore = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    let name = nanoid();
    let ext = file.originalname.split('.').pop()
    cb(null, `${name}.${ext}`);
  }
})
app.use(multer({ storage: fileStore, fileFilter: filter }).single('image'));

// initialize static content location
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// initialize template engine
app.set('view engine', 'ejs');
app.set('views', 'views');

// initialize session manager
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const sessionSecret = require('./secure').sessionSecret;
const connectionString = require('./secure').connectionString;
const store = new MongoDBStore({
  uri: connectionString,
  collection: 'sessions'
});
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: store
  })
);

// initialize CSRF protection
const csrf = require('csurf');
const csrfProtection = csrf();
app.use(csrfProtection);

// initialize flash storage
const flash = require('connect-flash');
app.use(flash());

// initialize response local variables
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

// sync session and request with user data
const User = require('./models/user');
app.use((req, res, next) => {
  if (!req.session.user) {
    req.user = undefined;
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        req.session.user = undefined;
        req.user = undefined;
        return next();
      }
      req.user = user;
      next();
    })
    .catch(err => {
      console.error('Error initializing user data in session.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
});

// initialize routes
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);
const shopRoutes = require('./routes/shop');
app.use(shopRoutes);
const authRoutes = require('./routes/auth');
app.use(authRoutes);
const errorController = require('./controllers/error');
app.get('/500', errorController.get500);
app.get(errorController.get404);
// route for handling uncaught thrown errors
app.use((error, req, res, next) => {
  console.error('Uncaught error:', err);
  res.status(500).render('500', {
    pageTitle: 'System Error!',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn
  });
});

// Initialize database
const mongoose = require('mongoose');
mongoose
  .connect(connectionString, { useNewUrlParser: true })
  .then(result => {
    const port = 3000;
    app.listen(port, () => console.log(`Node listening on port: ${port}`));
  })
  .catch(err => {
    console.log(err);
  });

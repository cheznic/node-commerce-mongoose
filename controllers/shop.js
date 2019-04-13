const fs = require('fs');
const path = require('path');

const PdfDocument = require('pdfkit');
const stripe = require("stripe")("sk_test_g37L8hJ5YmgnvKVNkv8BDcZs00VvRC3YYO");

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let itemCount;

  Product.find()
    .countDocuments()
    .then(count => {
      itemCount = count;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        currentPage: page,
        hasNextPage: (ITEMS_PER_PAGE * page) < itemCount,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1
      });
    })
    .catch(err => {
      console.error('Error retrieving products.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      console.error(`Error retrieving product: ${prodId}`, err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let itemCount;

  Product.find()
    .countDocuments()
    .then(count => {
      itemCount = count;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: (ITEMS_PER_PAGE * page) < itemCount,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1
      });
    })
    .catch(err => {
      console.error('Error retrieving products.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      console.error('Error retrieving cart.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      console.error('Error updating cart.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      console.error('Error deleting item from cart.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      let total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: total
      });
    })
    .catch(err => {
      console.error('Error retrieving cart.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}

exports.postOrder = (req, res, next) => {
  const token = req.body.stripeToken;
  let totalSum = 0;
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      user.cart.items.forEach(p => {
        totalSum += p.quantity * p.productId.price;
      })
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(async result => {
      const charge = await stripe.charges.create({
        amount: totalSum * 100,
        currency: 'usd',
        description: 'Demo Order',
        source: token,
        metadata: { order_id: result._id.toString() }
      });
      // console.log(charge);
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      console.error('Error creating order.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      console.error('Error retrieving orders.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('Order not found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized.'));
      }
      const invoiceName = `invoice-${orderId}.pdf`;
      const invoicePath = path.join('data', 'invoices', invoiceName);

      // Example of dynamically generated PDF returned on request.
      const pdf = new PdfDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);
      pdf.pipe(fs.createWriteStream(invoicePath));
      pdf.pipe(res);
      pdf.fontSize(26).text('Invoice', { underline: true });
      pdf.fontSize(14).text('------------------');
      let total = 0;
      order.products.forEach(prod => {
        total += (prod.quantity * prod.product.price);
        pdf.fontSize(14).text(`${prod.product.title} - ${prod.quantity} x $${prod.product.price}`);
      });
      pdf.fontSize(14).text('------------------');
      pdf.text(`Total Price: $${total}`);
      pdf.end();

      // // The following commented out example of returning file content is 
      // // not ideal.  This reads the entire file into memory before  
      // // sending it to the client.
      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);
      //   res.send(data);
      // });

      // // This is an example of streaming and is a much preferred method of sending
      // // file content. It starts sending to the client chunk by chunk.
      // const file = fs.createReadStream(invoicePath);
      // res.setHeader('Content-Type', 'application/pdf');
      // res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);
      // file.pipe(res);
    })
    .catch(err => {
      console.error('Error retrieving invoice.', err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}

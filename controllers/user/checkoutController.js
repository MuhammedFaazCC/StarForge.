const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema");
const { login } = require("./userController");


const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addresses = await Address.find({ userId: userId }).sort({ createdAt: -1 });
    const addressId = req.params.addressId;
    const address = await Address.findOne({ _id: addressId });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const cartItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      subtotal: item.quantity * item.productId.salesPrice,
    }));

    const total = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

    res.render("checkout", { user: req.session.user, cartItems, total, addresses, address });

  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).send("Server error");
  }
};

const postCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { selectedAddressId, paymentMethod } = req.body;

    if (!selectedAddressId) {
      return res.status(400).json({ error: "Please select a shipping address" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: "Please select a payment method" });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');


    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const selectedAddress = await Address.findById(selectedAddressId);
    if (!selectedAddress) {
      return res.status(400).json({ error: "Invalid address selected" });
    }

    for (const item of cart.items) {
      if (item.productId.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.productId.name}. Available: ${item.productId.stock}, Requested: ${item.quantity}` 
        });
      }
    }
    let totalAmount = 0
    let price = 0
    let quantity = 0
    for (const item of cart.items) {
     const productId= item.productId._id
     const name= item.productId.name
      price= item.productId.salesPrice
      quantity= item.quantity
    
     totalAmount = price*quantity;
    
    }
console.log(totalAmount,'total amount');
    const newOrder = new Order({
      userId,
      items: cart.items,
      address: {
        fullName: selectedAddress.fullName,
        address: selectedAddress.address,
        city: selectedAddress.city,
        district: selectedAddress.district,
        state: selectedAddress.state,
        pinCode: selectedAddress.pinCode,
        email: selectedAddress.email
      },
      paymentMethod,
      totalAmount,
      status: "Processing",
      createdAt: new Date(),
    });

    await newOrder.save();

    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } }
      );
    }
    
    await Cart.deleteOne({ userId });
    res.render("orderPlaced");

  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).send("Checkout failed");
  }
};

// const orderPlaced = async (req, res) => {
//   const { selectedAddressId, paymentMethod } = req.body;
//   const userId = req.session.userId;

//   try {
//     const address = await Address.findOne({ _id: selectedAddressId, userId });

//     const newOrder = new Order({
//       userId,
//       address,
//       paymentMethod,
//       items: req.session.cart,
//       status: 'Placed',
//       createdAt: new Date()
//     });

//     await newOrder.save();

//     req.session.cart = [];

//     res.redirect('/order-success');
//   } catch (error) {
//     console.error('Order placement failed:', error);
//     res.status(500).send('Something went wrong while placing your order.');
//   }
// };

// const orderSuccess = async (req, res) => {
//     try {
//         res.render('orderSuccess');
//     } catch (error) {
//         console.error("Error:", error);
//         res.status(500).send("Order Failed");
//     }
// };


module.exports = {
    getCheckoutPage,
    postCheckoutPage,
    // orderPlaced,
};
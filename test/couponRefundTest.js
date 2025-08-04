const { handleCouponInvalidationAndRefund } = require('../util/couponRefundHandler');

const mockOrder = {
  _id: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012',
  totalAmount: 1500,
  paymentMethod: 'Online',
  coupon: {
    code: 'SAVE20',
    discountAmount: 200
  },
  items: [
    {
      productId: '507f1f77bcf86cd799439013',
      name: 'Product A',
      salesPrice: 500,
      quantity: 1,
      status: 'Ordered'
    },
    {
      productId: '507f1f77bcf86cd799439014',
      name: 'Product B',
      salesPrice: 600,
      quantity: 1,
      status: 'Ordered'
    },
    {
      productId: '507f1f77bcf86cd799439015',
      name: 'Product C',
      salesPrice: 400,
      quantity: 1,
      status: 'Ordered'
    }
  ]
};

const mockCoupon = {
  code: 'SAVE20',
  discount: 20,
  minimumAmount: 1000,
  maxDiscount: 500
};

const mockCouponFind = (code) => {
  if (code === 'SAVE20') {
    return Promise.resolve(mockCoupon);
  }
  return Promise.resolve(null);
};

async function runTests() {
  console.log('Testing Coupon Invalidation and Refund Logic\n');

  console.log('Scenario 1: Cancel Product A (₹500), coupon remains valid');
  console.log('Original order total: ₹1500, Coupon discount: ₹200');
  console.log('After cancellation: ₹1100 (still above ₹1000 minimum)');
  
  const scenario1Order = JSON.parse(JSON.stringify(mockOrder));
  const itemsToCancel1 = [{
    productId: '507f1f77bcf86cd799439013',
    name: 'Product A',
    salesPrice: 500,
    quantity: 1
  }];

  require('../models/couponSchema').findOne = mockCouponFind;

  try {
    const result1 = await handleCouponInvalidationAndRefund(scenario1Order, itemsToCancel1, 'user123');
    
    console.log('Results:');
    console.log(`   - Coupon removed: ${result1.couponRemoved}`);
    console.log(`   - Coupon recalculated: ${result1.couponRecalculated}`);
    console.log(`   - Total refund amount: ₹${result1.totalRefundAmount}`);
    console.log(`   - New order total: ₹${result1.newOrderTotal}`);
    console.log(`   - New coupon discount: ₹${scenario1Order.coupon.discountAmount}`);
    
    if (result1.itemRefunds.length > 0) {
      console.log('   - Item refund details:');
      result1.itemRefunds.forEach(refund => {
        console.log(`     * ${refund.productName}: ₹${refund.refundAmount} (${refund.reason})`);
      });
    }
  } catch (error) {
    console.error('Error in scenario 1:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('Scenario 2: Cancel Product B and C (₹1000), coupon becomes invalid');
  console.log('Original order total: ₹1500, Coupon discount: ₹200');
  console.log('After cancellation: ₹500 (below ₹1000 minimum)');
  
  const scenario2Order = JSON.parse(JSON.stringify(mockOrder));
  const itemsToCancel2 = [
    {
      productId: '507f1f77bcf86cd799439014',
      name: 'Product B',
      salesPrice: 600,
      quantity: 1
    },
    {
      productId: '507f1f77bcf86cd799439015',
      name: 'Product C',
      salesPrice: 400,
      quantity: 1
    }
  ];

  try {
    const result2 = await handleCouponInvalidationAndRefund(scenario2Order, itemsToCancel2, 'user123');
    
    console.log('Results:');
    console.log(`   - Coupon removed: ${result2.couponRemoved}`);
    console.log(`   - Coupon recalculated: ${result2.couponRecalculated}`);
    console.log(`   - Total refund amount: ₹${result2.totalRefundAmount}`);
    console.log(`   - New order total: ₹${result2.newOrderTotal}`);
    console.log(`   - New coupon discount: ₹${scenario2Order.coupon.discountAmount}`);
    
    if (result2.itemRefunds.length > 0) {
      console.log('   - Item refund details:');
      result2.itemRefunds.forEach(refund => {
        console.log(`     * ${refund.productName}: ₹${refund.refundAmount} (${refund.reason})`);
      });
    }
  } catch (error) {
    console.error('Error in scenario 2:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('Scenario 3: Cancel all items (full order cancellation)');
  console.log('Original order total: ₹1500, Coupon discount: ₹200');
  console.log('After cancellation: ₹0 (all items cancelled)');
  
  const scenario3Order = JSON.parse(JSON.stringify(mockOrder));
  const itemsToCancel3 = [
    {
      productId: '507f1f77bcf86cd799439013',
      name: 'Product A',
      salesPrice: 500,
      quantity: 1
    },
    {
      productId: '507f1f77bcf86cd799439014',
      name: 'Product B',
      salesPrice: 600,
      quantity: 1
    },
    {
      productId: '507f1f77bcf86cd799439015',
      name: 'Product C',
      salesPrice: 400,
      quantity: 1
    }
  ];

  try {
    const result3 = await handleCouponInvalidationAndRefund(scenario3Order, itemsToCancel3, 'user123');
    
    console.log('Results:');
    console.log(`   - Coupon removed: ${result3.couponRemoved}`);
    console.log(`   - Coupon recalculated: ${result3.couponRecalculated}`);
    console.log(`   - Total refund amount: ₹${result3.totalRefundAmount}`);
    console.log(`   - New order total: ₹${result3.newOrderTotal}`);
    console.log(`   - New coupon discount: ₹${scenario3Order.coupon.discountAmount}`);
    
    if (result3.itemRefunds.length > 0) {
      console.log('   - Item refund details:');
      result3.itemRefunds.forEach(refund => {
        console.log(`     * ${refund.productName}: ₹${refund.refundAmount} (${refund.reason})`);
      });
    }
  } catch (error) {
    console.error('Error in scenario 3:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('📋 Scenario 4: Cancel item from order without coupon');
  
  const scenario4Order = {
    ...JSON.parse(JSON.stringify(mockOrder)),
    coupon: { code: null, discountAmount: 0 },
    totalAmount: 1500
  };
  
  const itemsToCancel4 = [{
    productId: '507f1f77bcf86cd799439013',
    name: 'Product A',
    salesPrice: 500,
    quantity: 1
  }];

  try {
    const result4 = await handleCouponInvalidationAndRefund(scenario4Order, itemsToCancel4, 'user123');
    
    console.log('Results:');
    console.log(`   - Coupon removed: ${result4.couponRemoved}`);
    console.log(`   - Coupon recalculated: ${result4.couponRecalculated}`);
    console.log(`   - Total refund amount: ₹${result4.totalRefundAmount}`);
    console.log(`   - New order total: ₹${result4.newOrderTotal}`);
    
    if (result4.itemRefunds.length > 0) {
      console.log('   - Item refund details:');
      result4.itemRefunds.forEach(refund => {
        console.log(`     * ${refund.productName}: ₹${refund.refundAmount} (${refund.reason})`);
      });
    }
  } catch (error) {
    console.error('Error in scenario 4:', error.message);
  }

  console.log('\nAll test scenarios completed!');
}

module.exports = {
  runTests,
  mockOrder,
  mockCoupon
};

if (require.main === module) {
  runTests().catch(console.error);
}
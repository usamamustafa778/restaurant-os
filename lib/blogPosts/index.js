/**
 * EatsDesk marketing blog — static posts for SEO.
 * Generated/maintained via scripts/generateExpandedBlogPosts.mjs
 */

import aiReceptionistForRestaurants from './posts/ai-receptionist-for-restaurants.js';
import bestRestaurantPosSystemPakistan from './posts/best-restaurant-pos-system-pakistan.js';
import biryaniRestaurantPosFeatures from './posts/biryani-restaurant-pos-features.js';
import cloudKitchenPosSystemPakistan from './posts/cloud-kitchen-pos-system-pakistan.js';
import easypaisaJazzcashRestaurantPos from './posts/easypaisa-jazzcash-restaurant-pos.js';
import fastFoodFranchisePosRequirements from './posts/fast-food-franchise-pos-requirements.js';
import foodCostPercentageRestaurantGuide from './posts/food-cost-percentage-restaurant-guide.js';
import kitchenDisplaySystemFastFood from './posts/kitchen-display-system-fast-food.js';
import multiBranchRestaurantManagementSoftware from './posts/multi-branch-restaurant-management-software.js';
import onlineOrderingWithoutFoodpandaCommission from './posts/online-ordering-without-foodpanda-commission.js';
import qrCodeMenuRestaurantPakistan from './posts/qr-code-menu-restaurant-pakistan.js';
import reduceOrderErrorsFastFood from './posts/reduce-order-errors-fast-food.js';
import restaurantCrmRepeatCustomersPakistan from './posts/restaurant-crm-repeat-customers-pakistan.js';
import restaurantDeliveryRiderManagementApp from './posts/restaurant-delivery-rider-management-app.js';
import restaurantEndOfDayReportCashReconciliation from './posts/restaurant-end-of-day-report-cash-reconciliation.js';
import restaurantInventoryManagementTips from './posts/restaurant-inventory-management-tips.js';
import restaurantManagementSoftwareVsExcel from './posts/restaurant-management-software-vs-excel.js';
import restaurantPosSoftwareLahoreKarachiIslamabad from './posts/restaurant-pos-software-lahore-karachi-islamabad.js';
import restaurantWebsiteWithOnlineOrderingFree from './posts/restaurant-website-with-online-ordering-free.js';
import whatsappAiReceptionistRestaurants from './posts/whatsapp-ai-receptionist-restaurants.js';

const posts = [
  aiReceptionistForRestaurants,
  bestRestaurantPosSystemPakistan,
  biryaniRestaurantPosFeatures,
  cloudKitchenPosSystemPakistan,
  easypaisaJazzcashRestaurantPos,
  fastFoodFranchisePosRequirements,
  foodCostPercentageRestaurantGuide,
  kitchenDisplaySystemFastFood,
  multiBranchRestaurantManagementSoftware,
  onlineOrderingWithoutFoodpandaCommission,
  qrCodeMenuRestaurantPakistan,
  reduceOrderErrorsFastFood,
  restaurantCrmRepeatCustomersPakistan,
  restaurantDeliveryRiderManagementApp,
  restaurantEndOfDayReportCashReconciliation,
  restaurantInventoryManagementTips,
  restaurantManagementSoftwareVsExcel,
  restaurantPosSoftwareLahoreKarachiIslamabad,
  restaurantWebsiteWithOnlineOrderingFree,
  whatsappAiReceptionistRestaurants,
];

export function getAllBlogPosts() {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  );
}

export function getBlogPost(slug) {
  return posts.find((p) => p.slug === slug) || null;
}

export function getBlogSlugs() {
  return posts.map((p) => p.slug);
}

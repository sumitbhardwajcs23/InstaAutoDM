// frontend/src/components/TemplatesView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Zap,
  Check,
  Copy,
  Lock,
  MessageCircle,
  Send,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  Flame,
  Sparkles,
  ExternalLink,
  Eye,
  X,
  Smartphone,
  Film,
  Play,
  ArrowRight,
  Layers,
  Heart,
  ChevronRight,
  Edit3,
  Plus
} from 'lucide-react';
import { apiFetch } from '../api/client';
import TemplateEditorModal from './TemplateEditorModal';

export const TEMPLATES_DATA = [
  // --- 1. E-COMMERCE & RETAIL (7 Templates) ---
  {
    id: 'ecom-discount-drop',
    name: 'Exclusive Promo Code & Discount Drop',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '🔥 Highest Conversion',
    trigger_keyword: 'DISCOUNT',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Instantly delivers a visual discount card to shoppers who comment on your product or sale reel.',
    comment_reply_message: 'Sent your 20% OFF code in DM! 🚀 | Check your inbox for the discount card! 📩 | Card sent! Check DMs ✨',
    dm_reply_message: "Hey {username}! 🎁 Here is your exclusive 20% discount code: VIP20\n\nValid on our entire collection for the next 24 hours only!",
    card_enabled: 1,
    card_title: '🎁 Exclusive 20% Discount Code: VIP20',
    card_subtitle: 'Use code VIP20 at checkout for 20% off your entire order today only!',
    card_image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Shop 20% Off 🛍️',
    card_button_url: 'https://yourbrand.com/shop',
    stats: '94% Open Rate • 38% CTR',
  },
  {
    id: 'ecom-product-catalog',
    name: 'Curated Lookbook & Best-Sellers Catalog',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '🛍️ Product Showcase',
    trigger_keyword: 'CATALOG',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Sends your full digital seasonal catalog as a rich visual card directly to interested shoppers.',
    comment_reply_message: 'Catalog card sent to your DM! 📖 | Lookbook in your inbox! 📩 | Check your DMs for the full collection! ✨',
    dm_reply_message: "Hey {username}! 📖 Here is our new seasonal Lookbook & Catalog with free domestic shipping on orders over $50!",
    card_enabled: 1,
    card_title: '📖 New Season Lookbook & Catalog',
    card_subtitle: 'Browse 40+ trending seasonal styles, sizing specs, and runway picks.',
    card_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Open Catalog 👗',
    card_button_url: 'https://yourbrand.com/catalog',
    stats: '88% Open Rate • 44% CTR',
  },
  {
    id: 'ecom-size-guide',
    name: 'Product Size & Fit Consultation',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '⚡ Reduces Returns',
    trigger_keyword: 'SIZE',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Delivers detailed measurements and height/weight fit recommendations to prevent cart abandonment.',
    comment_reply_message: 'Sizing chart sent to your DM! 📏 | Check your inbox for the fit guide card! 📩',
    dm_reply_message: "Hey {username}! 📏 Here is the complete size & fit breakdown for this collection. Pro tip: If you prefer oversized fit, size up one size!",
    card_enabled: 1,
    card_title: '📏 Product Size & Measurement Guide',
    card_subtitle: 'Find your perfect size with our interactive height/weight sizing matrix.',
    card_image_url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'View Size Chart 📐',
    card_button_url: 'https://yourbrand.com/size-guide',
    stats: '91% Open Rate • 29% Conversion',
  },
  {
    id: 'ecom-restock-vip',
    name: 'Restock Notification VIP List',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '🌟 High Urgency',
    trigger_keyword: 'RESTOCK',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to join the early restock VIP list! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for early access 🚀",
    description: 'Gives verified followers 1-hour early access before sold-out inventory drops publicly.',
    comment_reply_message: 'Added to VIP restock list! Check DM ⚡ | You have early access! Check inbox 📩',
    dm_reply_message: "You're in, {username}! ⚡ You'll get access to the restock 1 hour before everyone else. Bookmark your private VIP link here!",
    card_enabled: 1,
    card_title: '⚡ VIP Early Access: Inventory Restock',
    card_subtitle: 'Private 1-hour priority shopping window before public sold-out drop.',
    card_image_url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Claim Early Access 🎟️',
    card_button_url: 'https://yourbrand.com/vip-restock',
    stats: '97% Open Rate • 52% Conversion',
  },
  {
    id: 'ecom-abandoned-cart',
    name: 'Abandoned Cart & Checkout Reviver',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '💰 Revenue Saver',
    trigger_keyword: 'CART',
    match_mode: 'contains',
    action_type: 'dm',
    require_follow: false,
    description: 'Automatically triggers an incentive when a lead asks about completing an order in DMs.',
    dm_reply_message: "Hey {username}! Did you leave something in your cart? 🛒 Use code FINISH15 at checkout to get 15% off!",
    card_enabled: 1,
    card_title: '🛒 Complete Your Order & Save 15%',
    card_subtitle: 'Your bag is waiting! Use code FINISH15 for instant savings today.',
    card_image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Complete Checkout 💳',
    card_button_url: 'https://yourbrand.com/checkout',
    stats: '86% Open Rate • 31% Recovery',
  },
  {
    id: 'ecom-free-shipping',
    name: 'Free Shipping Unlock Code',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '📦 Zero Friction',
    trigger_keyword: 'FREESHIP',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Removes the #1 reason for cart abandonment by providing an instant free shipping link card.',
    comment_reply_message: 'Free shipping code sent to your DMs! 📦 | Check your DM for zero shipping fees! 🚀',
    dm_reply_message: "Hey {username}! 🚚 Here is your free shipping voucher valid on all orders placed today with tracking included!",
    card_enabled: 1,
    card_title: '🚚 Free Express Shipping Voucher',
    card_subtitle: 'Zero shipping fees on all orders placed today. Live package tracking included.',
    card_image_url: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Activate Free Shipping 📦',
    card_button_url: 'https://yourbrand.com/cart',
    stats: '92% Open Rate • 41% CTR',
  },
  {
    id: 'ecom-wholesale-b2b',
    name: 'Wholesale & B2B Bulk Order Inquiry',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '🏢 High Ticket B2B',
    trigger_keyword: 'WHOLESALE',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Routes business buyers, retailers, and boutique owners directly to your wholesale catalog and tier discounts.',
    comment_reply_message: 'Wholesale catalog sent to DM! 🏢 | B2B details in your inbox! 📩',
    dm_reply_message: "Hello {username}! 🤝 Download our Wholesale Line Sheet & Tier Pricing below. Minimum order quantities start at 50 units.",
    card_enabled: 1,
    card_title: '🏢 Wholesale & B2B Tier Pricing Sheet',
    card_subtitle: 'Download bulk order price tiers, MOQs, and distributor partnership terms.',
    card_image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Download Line Sheet 📑',
    card_button_url: 'https://yourbrand.com/wholesale',
    stats: '89% Open Rate • 48% Response Rate',
  },

  // --- 2. CREATORS, COACHES & DIGITAL PRODUCTS (7 Templates) ---
  {
    id: 'creator-free-masterclass',
    name: 'Free Masterclass / Workshop VIP Seat',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '🚀 High Viral Growth',
    trigger_keyword: 'MASTERCLASS',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage first to get your free Masterclass seat! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs to unlock your seat 🎓",
    description: 'Grow followers 4x by gating exclusive training, workshop replays, or webinars behind a follower check.',
    comment_reply_message: 'Masterclass pass sent to your DMs! 🎓 | Check your inbox for the workshop link! 🚀 | Seat reserved! Check DM ✨',
    dm_reply_message: "🎉 Welcome {username}! Your seat is confirmed for the Masterclass. Included: 60-min video replay + Notion action sheet!",
    card_enabled: 1,
    card_title: '🎓 Live Masterclass VIP Seat Confirmed',
    card_subtitle: '60-min high-impact training replay + downloadable Notion action sheet.',
    card_image_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Join Masterclass 🚀',
    card_button_url: 'https://airvix.com/masterclass-live',
    stats: '96% Open Rate • 4.2x Follower Boost',
  },
  {
    id: 'creator-ebook-blueprint',
    name: 'Free E-Book / PDF Blueprint Delivery',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '📥 Evergreen Lead Magnet',
    trigger_keyword: 'EBOOK',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to unlock your free E-Book download! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for the download link 📘",
    description: 'Distribute guides, cheat sheets, and checklists directly inside DMs while gaining verified followers.',
    comment_reply_message: 'Guide sent to your DM! 📘 | Check your inbox for the PDF blueprint! 📩',
    dm_reply_message: "Hey {username}! 📘 Here is your free download of the Ultimate Blueprint with cheat sheets and frameworks!",
    card_enabled: 1,
    card_title: '📘 Ultimate Growth Blueprint (PDF)',
    card_subtitle: '24-page step-by-step roadmap with frameworks, checklists & examples.',
    card_image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Download Guide (PDF) 📥',
    card_button_url: 'https://airvix.com/free-guide.pdf',
    stats: '95% Open Rate • 68% Download Rate',
  },
  {
    id: 'creator-strategy-call',
    name: '1-on-1 Consultation & Discovery Call',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '💼 High-Ticket Sales',
    trigger_keyword: 'CALL',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Puts prospective coaching clients directly onto your Calendly or booking schedule.',
    comment_reply_message: 'Booking link sent to DM! 📅 | Check your inbox to reserve a time! 📩',
    dm_reply_message: "Hey {username}! 👋 I'd love to chat about your goals and see how we can work together. Pick a time below!",
    card_enabled: 1,
    card_title: '📅 1-on-1 Strategy & Audit Call',
    card_subtitle: 'Reserve a private 30-min strategy session to review your roadmap.',
    card_image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Book 30-Min Call 🗓️',
    card_button_url: 'https://calendly.com/your-name/30min',
    stats: '89% Open Rate • 34% Booking Rate',
  },
  {
    id: 'creator-podcast-notes',
    name: 'Podcast VIP Show Notes & Transcripts',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '🎙️ Audience Retention',
    trigger_keyword: 'NOTES',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Sends listeners the direct links, resource timestamps, and sponsor discounts mentioned in your episode.',
    comment_reply_message: 'Show notes sent to DM! 🎙️ | Check your inbox for all episode links! 📩',
    dm_reply_message: "Hey {username}! 🎙️ Here are the complete show notes, timestamps, and resource links from this episode!",
    card_enabled: 1,
    card_title: '🎙️ Episode VIP Notes & Timestamps',
    card_subtitle: 'Full transcript, key takeaways, recommended tools, and sponsor perks.',
    card_image_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'View Show Notes 🎧',
    card_button_url: 'https://airvix.com/episodes/notes',
    stats: '91% Open Rate • 42% CTR',
  },
  {
    id: 'creator-lightroom-preset',
    name: 'Lightroom Presets & Wallpapers Freebie',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '📸 Aesthetic Creator',
    trigger_keyword: 'PRESET',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to unlock the free preset pack! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for the download link 📸",
    description: 'Gives verified followers the exact editing preset DNG files used in your viral Reels and photos.',
    comment_reply_message: 'Preset pack sent to your DM! 📸 | Check your inbox for the download! ✨',
    dm_reply_message: "Hey {username}! 🎨 Here is the direct download link for the Moody Warmth Mobile & Desktop Preset pack!",
    card_enabled: 1,
    card_title: '📸 Moody Warmth Lightroom Preset Pack',
    card_subtitle: 'Free mobile & desktop DNG presets with step-by-step video installation guide.',
    card_image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Download Presets 🎨',
    card_button_url: 'https://airvix.com/preset-pack.zip',
    stats: '98% Open Rate • 5.1x Follower Boost',
  },
  {
    id: 'creator-course-syllabus',
    name: 'Course Curriculum & Early Enrollment',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '📚 Course Launch',
    trigger_keyword: 'SYLLABUS',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Sends prospective students full breakdown of module lessons, pricing tiers, and enrollment deadlines.',
    comment_reply_message: 'Course syllabus sent to DM! 📚 | Check your inbox for the curriculum! 📩',
    dm_reply_message: "Hey {username}! 📚 Here is the full syllabus and lesson breakdown for the upcoming cohort.",
    card_enabled: 1,
    card_title: '📚 Masterclass Cohort Curriculum',
    card_subtitle: 'Review 8 weekly deep-dive modules, homework assignments, and tuition options.',
    card_image_url: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'View Full Syllabus 📖',
    card_button_url: 'https://airvix.com/academy-syllabus',
    stats: '87% Open Rate • 26% Enrollment CTR',
  },
  {
    id: 'creator-challenge-signup',
    name: '7-Day Challenge & Community Pass',
    category: 'creator',
    categoryLabel: '🎓 Creators & Coaches',
    badge: '🔥 High Engagement',
    trigger_keyword: 'CHALLENGE',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to join the 7-Day Challenge! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs to get started 🚀",
    description: 'Automates participant registration and delivers daily exercise / action prompts to their inbox.',
    comment_reply_message: 'You are registered! Check your DM 🚀 | Day 1 details sent to your inbox! ✨',
    dm_reply_message: "You're in for the 7-Day Challenge, {username}! 🏁 Here is your Day 1 briefing and private community invite!",
    card_enabled: 1,
    card_title: '🏁 7-Day Sprint Challenge & Group Pass',
    card_subtitle: 'Daily step-by-step action prompts + accountability group access.',
    card_image_url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Access Day 1 Briefing 🏆',
    card_button_url: 'https://airvix.com/challenge-day1',
    stats: '96% Open Rate • 74% Participation',
  },

  // --- 3. FOLLOWER CHECK & LEAD MAGNETS (5 Templates) ---
  {
    id: 'gate-viral-giveaway',
    name: 'Viral Reel Giveaway Entry & Verification',
    category: 'lead_magnet',
    categoryLabel: '🔒 Follower Check',
    badge: '🎁 Viral Explosion',
    trigger_keyword: 'GIVEAWAY',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! To officially enter the giveaway, you must follow @ourpage! Tap \"✅ I've Followed\" below to lock in your entry 🎁",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs to confirm your entry 🚀",
    description: 'Guarantees that 100% of giveaway entrants follow your account before receiving their entry ticket number.',
    comment_reply_message: 'Giveaway ticket sent to your DMs! 🎟️ | Entry verified! Check inbox 📩',
    dm_reply_message: "🎉 You are officially entered into the Giveaway, {username}! Winner will be drawn live on our Instagram Stories this Friday.",
    card_enabled: 1,
    card_title: '🎟️ Official Giveaway Entry Confirmed',
    card_subtitle: 'Your entry ticket is registered! Winner announced live on Stories this Friday.',
    card_image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'View Ticket & Rules 🎁',
    card_button_url: 'https://airvix.com/giveaway-entry',
    stats: '99% Open Rate • 6.4x Follower Boost',
  },
  {
    id: 'gate-secret-vault',
    name: 'Secret AI Tools & Prompts Vault',
    category: 'lead_magnet',
    categoryLabel: '🔒 Follower Check',
    badge: '🔒 Follow-to-Unlock',
    trigger_keyword: 'SECRET',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Follow @ourpage to unlock the Secret Vault! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs to unlock the vault 🔐",
    description: 'Delivers a high-value resource library containing 50+ curated templates and prompts only to followers.',
    comment_reply_message: 'Secret Vault unlocked! Check DM 🔐 | Vault link sent to your inbox! ✨',
    dm_reply_message: "🔓 Access Granted, {username}! Enjoy the 50+ prompts, tools, and workflows inside the vault!",
    card_enabled: 1,
    card_title: '🔓 Secret AI Prompts & Tools Vault',
    card_subtitle: 'Password-protected access to 50+ tested automations and prompt chains.',
    card_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Unlock Vault (Key: VIP) 🔑',
    card_button_url: 'https://airvix.com/vault',
    stats: '97% Open Rate • 82% Unlock Rate',
  },
  {
    id: 'gate-notion-template',
    name: 'Free Notion Second Brain Dashboard',
    category: 'lead_magnet',
    categoryLabel: '🔒 Follower Check',
    badge: '⚡ Instant Value',
    trigger_keyword: 'NOTION',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Follow @ourpage to get duplicate access to the Notion Dashboard! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for the Notion link 📝",
    description: 'The classic viral template that drives thousands of comments on lifestyle, tech, and productivity Reels.',
    comment_reply_message: 'Notion template link sent! 📝 | Check your inbox to duplicate! 🚀',
    dm_reply_message: "Hey {username}! 📝 Click below to duplicate the Second Brain Notion Template directly into your workspace!",
    card_enabled: 1,
    card_title: '📝 Second Brain Notion Dashboard',
    card_subtitle: 'Duplicate our pre-built productivity system with projects, habits & CRM.',
    card_image_url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Duplicate Notion Board 📋',
    card_button_url: 'https://notion.so/airvix-template',
    stats: '96% Open Rate • 4.5x Follower Growth',
  },
  {
    id: 'gate-vip-product-drop',
    name: 'Secret VIP Password for Limited Drops',
    category: 'lead_magnet',
    categoryLabel: '🔒 Follower Check',
    badge: '👑 Exclusivity',
    trigger_keyword: 'VIP',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to unlock the secret VIP access link! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs to unlock VIP access 👑",
    description: 'Creates FOMO and excitement by giving only verified followers the password to a protected shop page.',
    comment_reply_message: 'VIP password sent to your DM! 👑 | Check inbox for private access! 📩',
    dm_reply_message: "Welcome to the inner circle, {username}! 👑 Here is your private access link to the drop 24 hours before everyone else.",
    card_enabled: 1,
    card_title: '👑 Private VIP Drop: Passcode Inside',
    card_subtitle: 'Secret passcode access 24 hours prior to public release. Limited pieces available.',
    card_image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Enter Secret Store 🛍️',
    card_button_url: 'https://yourbrand.com/vip-access',
    stats: '95% Open Rate • 48% Conversion',
  },
  {
    id: 'gate-private-community',
    name: 'Exclusive Telegram / Discord Invite',
    category: 'lead_magnet',
    categoryLabel: '🔒 Follower Check',
    badge: '👥 Community Hub',
    trigger_keyword: 'COMMUNITY',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Please follow @ourpage to unlock your private community invite! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for the invite link 💬",
    description: 'Turns reel viewers into engaged community members inside a private Telegram channel or Discord server.',
    comment_reply_message: 'Community invite link sent to DM! 💬 | Check your inbox to join the group! 🚀',
    dm_reply_message: "Hey {username}! 💬 Here is your single-use invite link to our private creator community for networking and live Q&A!",
    card_enabled: 1,
    card_title: '💬 Exclusive Creator Community Pass',
    card_subtitle: 'Single-use invite link for daily networking, feedback, and weekly live sessions.',
    card_image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Join Private Community 👥',
    card_button_url: 'https://t.me/+airvix_private_community',
    stats: '94% Open Rate • 61% Join Rate',
  },

  // --- 4. SERVICES, AGENCIES & LOCAL BUSINESS (6 Templates) ---
  {
    id: 'service-website-audit',
    name: 'Free Website & Funnel Video Audit',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '📈 High Value Pitch',
    trigger_keyword: 'AUDIT',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Converts Reel views into qualified agency leads by offering a personalized 5-minute video review of their site.',
    comment_reply_message: 'Audit link sent to DM! 📈 | Check your inbox to request your audit! 📩',
    dm_reply_message: "Hey {username}! 🚀 Submit your website URL and goals below to get your free 5-minute Loom video audit.",
    card_enabled: 1,
    card_title: '📈 Free Website & Funnel Video Audit',
    card_subtitle: 'Receive a personalized 5-minute screen-recorded video audit of your site.',
    card_image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Request Video Audit 🎯',
    card_button_url: 'https://airvix.com/free-audit',
    stats: '92% Open Rate • 44% Lead Submission',
  },
  {
    id: 'service-real-estate',
    name: 'Property Tour & Pricing Spec Sheet',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '🏡 High Ticket',
    trigger_keyword: 'PROPERTY',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Sends prospective home buyers the 3D virtual walkthrough tour, floor plans, and tax details.',
    comment_reply_message: 'Property details sent to DM! 🏡 | 3D Tour in your inbox! 📩',
    dm_reply_message: "Hello {username}! 🏡 Here is the complete listing package with 3D virtual tour, floor plan, and seller disclosures.",
    card_enabled: 1,
    card_title: '🏡 Luxury Property Tour & Specs',
    card_subtitle: 'Explore full 3D walkthrough, architectural floor plans, and pricing sheet.',
    card_image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'View 3D Tour & Price 🏠',
    card_button_url: 'https://yourbrand.com/property-tour',
    stats: '95% Open Rate • 39% Tour Clicks',
  },
  {
    id: 'service-fitness-workout',
    name: '30-Day Home Workout & Meal Plan',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '💪 Fitness & Health',
    trigger_keyword: 'WORKOUT',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: true,
    follow_prompt_message: "Hey {username}! Follow @ourpage to unlock the 30-Day Workout Plan! Tap \"✅ I've Followed\" below once done 🚀",
    follow_comment_reply: "Almost there! Follow @ourpage and check your DMs for the training guide 💪",
    description: 'Delivers full routine instructions and high-protein grocery lists to fitness enthusiasts.',
    comment_reply_message: 'Workout routine sent to DM! 💪 | Check your inbox for the meal plan! 🥗',
    dm_reply_message: "Let's get after it, {username}! 💪 Here is your free 30-Day Home Workout Plan with video tutorials for each exercise.",
    card_enabled: 1,
    card_title: '💪 30-Day Home Workout & Meal Plan',
    card_subtitle: 'Full zero-equipment training split + high-protein grocery guide.',
    card_image_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Start Workout Plan 🥗',
    card_button_url: 'https://airvix.com/fitness-plan',
    stats: '96% Open Rate • 71% Follower Growth',
  },
  {
    id: 'service-dental-consult',
    name: 'Local Service / Dental $100 Voucher',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '🦷 Local Business',
    trigger_keyword: 'SMILE',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Generates appointments for local clinics, med spas, and dentists with exclusive introductory credits.',
    comment_reply_message: '$100 voucher sent to your DM! ✨ | Check inbox for your appointment credit! 🦷',
    dm_reply_message: "Hello {username}! ✨ Here is your $100 new patient voucher for teeth whitening or consultation. Book online below!",
    card_enabled: 1,
    card_title: '✨ $100 Smile Consultation Voucher',
    card_subtitle: 'Exclusive voucher for cosmetic whitening, clear aligners, and dental checkup.',
    card_image_url: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Book with $100 Credit 🦷',
    card_button_url: 'https://yourclinic.com/smile-deal',
    stats: '90% Open Rate • 27% Booking Rate',
  },
  {
    id: 'service-case-study',
    name: 'Agency B2B Case Study Breakdown',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '📑 Social Proof',
    trigger_keyword: 'CASESTUDY',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Shows potential clients exactly how you achieved a 400% ROI for an existing customer.',
    comment_reply_message: 'Case study sent to DM! 📊 | Check your inbox for the revenue breakdown! 📩',
    dm_reply_message: "Hey {username}! 📊 Here is the uncensored 90-day case study breakdown on how we scaled revenue from $10k to $140k/mo.",
    card_enabled: 1,
    card_title: '📊 $420k ARR B2B Case Study Breakdown',
    card_subtitle: 'Step-by-step breakdown of ads, creative scripts, and automated DM funnels.',
    card_image_url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Read Full Case Study 📑',
    card_button_url: 'https://airvix.com/case-studies/420k',
    stats: '89% Open Rate • 52% Click-Through',
  },
  {
    id: 'service-restaurant-menu',
    name: 'Restaurant Menu & Free Dessert Pass',
    category: 'services',
    categoryLabel: '💼 Services & Agencies',
    badge: '🍽️ Hospitality',
    trigger_keyword: 'MENU',
    match_mode: 'contains',
    action_type: 'comment',
    comment_reply_mode: 'both',
    require_follow: false,
    description: 'Drives diner foot traffic by offering a complimentary dessert with any dinner reservation.',
    comment_reply_message: 'Menu & dessert voucher sent to DM! 🍽️ | Check your inbox to book a table! 🍷',
    dm_reply_message: "Buon appetito, {username}! 🍷 Reserve your table online below to receive a complimentary signature dessert on us!",
    card_enabled: 1,
    card_title: '🍽️ Chef Tasting Menu & Free Dessert',
    card_subtitle: 'Complimentary artisan dessert voucher included with every dinner reservation.',
    card_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Reserve Table + Free Dessert 🍷',
    card_button_url: 'https://yourrestaurant.com/reservations',
    stats: '93% Open Rate • 41% Reservation Rate',
  },
];

export default function TemplatesView({ onOpenCreateRule, account }) {
  const [templatesList, setTemplatesList] = useState(TEMPLATES_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'follow' | 'comment' | 'dm'
  const [copiedId, setCopiedId] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Template Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const loadDynamicTemplates = async () => {
    try {
      const res = await apiFetch('/site/templates');
      const data = await res.json();
      if (data && Array.isArray(data.templates) && data.templates.length > 0) {
        setTemplatesList(data.templates);
      }
    } catch (err) {
      // fallback to default TEMPLATES_DATA silently
    }
  };

  // Load custom/updated templates from backend API
  useEffect(() => {
    loadDynamicTemplates();
  }, []);

  // User's Connected Reels
  const [reels, setReels] = useState([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [selectedReel, setSelectedReel] = useState(null); // null = "All Reels & Posts"
  const [reelPickerOpen, setReelPickerOpen] = useState(false);

  // Fetch Reels for the connected account
  useEffect(() => {
    async function fetchReels() {
      setLoadingReels(true);
      try {
        const accParam = account?.id ? `?account_id=${account.id}&type=reels&limit=24` : '?type=reels&limit=24';
        const res = await apiFetch(`/instagram/media${accParam}`);
        const data = await res.json();
        if (data && Array.isArray(data.media)) {
          setReels(data.media);
        }
      } catch (err) {
        console.warn('Could not fetch reels for templates:', err.message);
      } finally {
        setLoadingReels(false);
      }
    }
    fetchReels();
  }, [account?.id]);

  const categories = useMemo(() => [
    { id: 'all', label: '🌟 All Templates', count: templatesList.length },
    { id: 'ecommerce', label: '🛍️ E-Commerce & Retail', count: templatesList.filter(t => t.category === 'ecommerce').length },
    { id: 'creator', label: '🎓 Creators & Coaches', count: templatesList.filter(t => t.category === 'creator' || t.category === 'education').length },
    { id: 'lead_magnet', label: '🔒 Follower Check', count: templatesList.filter(t => t.require_follow).length },
    { id: 'services', label: '💼 Services & Agencies', count: templatesList.filter(t => t.category === 'services' || t.category === 'agency').length },
  ], [templatesList]);

  const filteredTemplates = useMemo(() => {
    return templatesList.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'creator' && (item.category === 'creator' || item.category === 'education')) {
          // match
        } else if (selectedCategory === 'services' && (item.category === 'services' || item.category === 'agency')) {
          // match
        } else if (selectedCategory === 'lead_magnet' && item.require_follow) {
          // match
        } else if (item.category !== selectedCategory) {
          return false;
        }
      }
      // Sub-filter by feature
      if (filterType === 'follow' && !item.require_follow) return false;
      if (filterType === 'comment' && item.action_type !== 'comment') return false;
      if (filterType === 'dm' && item.action_type !== 'dm') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.name.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchKeyword = (item.trigger_keyword || '').toLowerCase().includes(q);
        const matchCard = item.card_title?.toLowerCase().includes(q);
        return matchTitle || matchDesc || matchKeyword || matchCard;
      }
      return true;
    });
  }, [templatesList, selectedCategory, filterType, searchQuery]);

  const handleCopy = (template) => {
    const textToCopy = `Card Title: ${template.card_title || template.name}\nSubtitle: ${template.card_subtitle || ''}\nTrigger Keyword: ${template.trigger_keyword}\nButton: ${template.card_button_text} -> ${template.card_button_url}\nDM Text: ${template.dm_reply_message}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Target Media Selection Modal State
  const [targetPromptOpen, setTargetPromptOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [targetSelectionMode, setTargetSelectionMode] = useState('next'); // 'next' | 'previous' | 'all'
  const [selectedPreviousReel, setSelectedPreviousReel] = useState(null);

  const handleUseTemplate = (template) => {
    setPendingTemplate(template);
    // If a reel is already selected in the topbar, pre-select 'previous' mode with that reel
    if (selectedReel) {
      setTargetSelectionMode('previous');
      setSelectedPreviousReel(selectedReel);
    } else {
      setTargetSelectionMode('next');
      if (reels && reels.length > 0) {
        setSelectedPreviousReel(reels[0]);
      }
    }
    setTargetPromptOpen(true);
  };

  const handleConfirmTargetSelection = () => {
    if (!pendingTemplate || !onOpenCreateRule) return;

    const chosenReel = targetSelectionMode === 'previous' ? selectedPreviousReel : null;
    const targetMediaId = chosenReel ? chosenReel.id : null;
    const targetMediaType = targetSelectionMode === 'previous' ? 'reel' : (targetSelectionMode === 'next' ? 'next_upload' : 'all');
    const targetMediaThumbnail = chosenReel ? (chosenReel.thumbnail_url || chosenReel.media_url) : null;
    const targetMediaCaption = chosenReel ? chosenReel.caption : (targetSelectionMode === 'next' ? '🚀 Next Uploaded Reel/Post' : null);

    onOpenCreateRule({
      name: pendingTemplate.name,
      trigger_keyword: pendingTemplate.trigger_keyword,
      match_mode: pendingTemplate.match_mode || 'contains',
      action_type: pendingTemplate.action_type,
      comment_reply_mode: pendingTemplate.comment_reply_mode || 'both',
      comment_reply_message: pendingTemplate.comment_reply_message || '',
      dm_reply_message: pendingTemplate.dm_reply_message || '',
      require_follow: pendingTemplate.require_follow ? 1 : 0,
      follow_prompt_message: pendingTemplate.follow_prompt_message || '',
      follow_comment_reply: pendingTemplate.follow_comment_reply || '',
      // Card specifics:
      card_enabled: 1,
      card_title: pendingTemplate.card_title || pendingTemplate.name,
      card_subtitle: pendingTemplate.card_subtitle || '',
      card_image_url: pendingTemplate.card_image_url,
      card_button_text: pendingTemplate.card_button_text || 'Open Link',
      card_button_url: pendingTemplate.card_button_url || 'https://',
      // Target Media specifics:
      target_media_id: targetMediaId,
      target_media_type: targetMediaType,
      target_media_thumbnail: targetMediaThumbnail,
      target_media_caption: targetMediaCaption,
    });

    setTargetPromptOpen(false);
    setPendingTemplate(null);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header & Metrics */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '20px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
            }}>
              <Sparkles size={19} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Message &amp; Reply Card Templates
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Deliver rich visual Instagram DM Cards with photos, headlines, and link buttons. Select a specific Reel to connect with 1 click.
          </p>
        </div>

        {/* Quick Stats Pills */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            padding: '8px 14px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Zap size={16} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>{TEMPLATES_DATA.length} Rich Cards</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Ready to Launch</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setEditingTemplate(null);
              setIsEditorOpen(true);
            }}
            style={{ padding: '10px 16px', fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Create New Template</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenCreateRule && onOpenCreateRule({ card_enabled: 1 })}
            style={{ padding: '10px 18px', fontSize: '13.5px', fontWeight: 700 }}
          >
            + Create Custom Card Rule
          </button>
        </div>
      </div>

      {/* REEL SELECTOR BAR: Connect Templates to a Specific Reel */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
        border: '1.5px solid #bfdbfe',
        borderRadius: '18px',
        padding: '16px 20px',
        marginBottom: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
          }}>
            <Film size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
                🎬 Target Specific Reel:
              </span>
              {selectedReel ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                }}>
                  REEL SELECTED
                </span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#475569',
                }}>
                  ALL REELS &amp; POSTS
                </span>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
              {selectedReel ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600 }}>"{selectedReel.caption ? selectedReel.caption.slice(0, 60) + '...' : 'Instagram Reel'}"</span>
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <span>{selectedReel.like_count || 0} Likes</span>
                </span>
              ) : (
                'All cards apply to all incoming comments across your entire profile. Select a specific Reel below to tie cards directly to that Reel.'
              )}
            </div>
          </div>
        </div>

        {/* Selected Reel Preview & Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedReel && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #bfdbfe',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
            }}>
              <img
                src={selectedReel.thumbnail_url || selectedReel.media_url}
                alt="Reel Thumb"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{ width: '30px', height: '38px', borderRadius: '4px', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => setSelectedReel(null)}
                title="Remove Reel target (Apply to all Reels)"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setReelPickerOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1.5px solid #2563eb',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Play size={13} fill="#fff" />
            <span>{selectedReel ? 'Change Reel' : 'Choose a Reel'}</span>
          </button>
        </div>
      </div>

      {/* INLINE REEL PICKER MODAL */}
      {reelPickerOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Select a Reel to Target
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReelPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Option to target All Reels */}
              <div
                onClick={() => {
                  setSelectedReel(null);
                  setReelPickerOpen(false);
                }}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: !selectedReel ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: !selectedReel ? 'var(--primary-light)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Layers size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                    🌐 Target All Reels &amp; Posts (Account-Wide)
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Any comment with the trigger keyword on any Reel will trigger this Rich Card.
                  </div>
                </div>
                {!selectedReel && <Check size={18} color="var(--primary)" />}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
                YOUR INSTAGRAM REELS ({reels.length})
              </div>

              {loadingReels ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Loading Reels from @{account?.username || 'your account'}...
                </div>
              ) : reels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No Reels found. You can still create rules that trigger across all posts.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {reels.map((reel) => {
                    const isSelected = selectedReel?.id === reel.id;
                    return (
                      <div
                        key={reel.id}
                        onClick={() => {
                          setSelectedReel(reel);
                          setReelPickerOpen(false);
                        }}
                        style={{
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border-subtle)',
                          background: 'var(--bg-card)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: isSelected ? '0 4px 14px rgba(37,99,235,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ position: 'relative', height: '180px', background: '#0f172a' }}>
                          <img
                            src={reel.thumbnail_url || reel.media_url}
                            alt="Reel"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <Play size={9} fill="#fff" /> Reel
                          </div>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(37, 99, 235, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff'
                            }}>
                              <Check size={28} />
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '4px'
                          }}>
                            {reel.caption || 'Instagram Reel'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                            <span>❤️ {reel.like_count || 0}</span>
                            <span>💬 {reel.comments_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '18px',
        padding: '16px 20px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            flex: '1',
            minWidth: '260px',
          }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-light)',
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by keyword (e.g. DISCOUNT, MASTERCLASS, NOTION)..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontSize: '13px',
                outline: 'none',
                color: 'var(--text-main)',
              }}
            />
          </div>

          {/* Quick Sub-Filter by Feature */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Cards' },
              { id: 'follow', label: '🔒 Follow-to-Unlock' },
              { id: 'comment', label: '💬 Comment-to-DM' },
              { id: 'dm', label: '✉️ Inbound DM' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: filterType === f.id ? 'var(--primary)' : 'var(--border-subtle)',
                  background: filterType === f.id ? 'var(--primary-light)' : 'transparent',
                  color: filterType === f.id ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: filterType === f.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border-light)',
                  background: isSelected ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{cat.label}</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                }}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Rich DM Card Templates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '24px',
      }}>
        {filteredTemplates.map((template) => {
          const cardImg = template.card_image_url;

          return (
            <div
              key={template.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '18px',
                border: '1px solid var(--border-light)',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }}
            >
              <div>
                {/* Visual Card Header Preview: Photo + Overlays */}
                <div style={{
                  position: 'relative',
                  height: '160px',
                  background: '#0f172a',
                  overflow: 'hidden'
                }}>
                  <img
                    src={cardImg}
                    alt={template.card_title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.92,
                      transition: 'transform 0.3s ease'
                    }}
                  />
                  {/* Subtle gradient vignette */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
                  }} />

                  {/* Top Badges */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 2
                  }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 9px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#1e293b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}>
                      🃏 Rich DM Card
                    </span>

                    {selectedReel && (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#2563eb',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Play size={10} fill="#fff" /> Reel Linked
                      </span>
                    )}

                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#f59e0b',
                      background: 'rgba(0,0,0,0.7)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(245,158,11,0.4)'
                    }}>
                      {template.badge}
                    </span>
                  </div>

                  {/* Card Title Floating in Header */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '14px',
                    right: '14px',
                    color: '#ffffff',
                    zIndex: 2
                  }}>
                    <div style={{
                      fontSize: '14.5px',
                      fontWeight: 800,
                      lineHeight: 1.3,
                      textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                    }}>
                      {template.card_title}
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div style={{ padding: '16px' }}>
                  {/* Card Subtitle description */}
                  <p style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                    margin: '0 0 12px 0',
                    lineHeight: 1.45
                  }}>
                    {template.card_subtitle || template.description}
                  </p>

                  {/* Simulated Instagram DM CTA Link Button */}
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #2563eb',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    textAlign: 'center',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.08)'
                  }}>
                    <ExternalLink size={13} color="#2563eb" />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>
                      {template.card_button_text}
                    </span>
                  </div>

                  {/* Keyword & Trigger Specs */}
                  <div style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    marginBottom: '12px',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Reel Keyword:</span>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        background: 'var(--bg-card)',
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: '5px',
                        border: '1px solid rgba(99,102,241,0.2)',
                      }}>
                        {template.trigger_keyword}
                      </span>
                    </div>

                    {template.require_follow ? (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#16a34a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Lock size={11} /> Follow-to-Unlock
                      </span>
                    ) : (
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                        ⚡ Instant Card DM
                      </span>
                    )}
                  </div>

                  {/* Public Comment Reply snippet */}
                  {template.comment_reply_message && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      background: 'rgba(236, 72, 153, 0.04)',
                      padding: '6px 9px',
                      borderRadius: '8px',
                      border: '1px solid rgba(236, 72, 153, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <MessageCircle size={12} color="#ec4899" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{template.comment_reply_message.split('|')[0].trim()}"
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* Test & Preview Modal Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(template)}
                    title="Preview full mobile Instagram comment & DM card flow"
                    style={{
                      padding: '7px 11px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>

                  {/* Edit Template Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(template);
                      setIsEditorOpen(true);
                    }}
                    title="Edit template image, headline, button & keyword"
                    style={{
                      padding: '7px 11px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Edit3 size={13} color="var(--primary)" />
                    <span>Edit</span>
                  </button>

                  {/* Copy Card Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopy(template)}
                    title="Copy card copy to clipboard"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: copiedId === template.id ? '#16a34a' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copiedId === template.id ? <Check size={14} /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Use Card Template Button */}
                <button
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  style={{
                    padding: '8px 15px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Zap size={14} />
                  <span>{selectedReel ? 'Use on this Reel' : 'Use Card Template'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FULL FLOW MOBILE INSTAGRAM DM CARD PREVIEW MODAL */}
      {previewTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '430px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Topbar */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} color="#6366f1" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  Live Instagram DM Card Flow
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile Phone Mockup Window */}
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              maxHeight: '76vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* Step 1: Reel Comment Simulation */}
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  1. Follower Comments on {selectedReel ? 'Your Reel' : 'Reel'}:
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>
                    AL
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      alice_shopper
                    </div>
                    <div style={{
                      fontSize: '12.5px',
                      color: '#1e293b',
                      background: '#f1f5f9',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      marginTop: '3px',
                      display: 'inline-block'
                    }}>
                      "{previewTemplate.trigger_keyword}"
                    </div>
                  </div>
                </div>

                {/* Public Reply under comment */}
                {previewTemplate.comment_reply_message && (
                  <div style={{ marginTop: '10px', paddingLeft: '42px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>
                      ⚡ Airvix Public Reply:
                    </div>
                    <div style={{
                      fontSize: '11.5px',
                      color: '#0f172a',
                      background: '#fdf2f8',
                      border: '1px solid #fbcfe8',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}>
                      {previewTemplate.comment_reply_message.split('|')[0].trim()}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Follower Check Gate (if applicable) */}
              {previewTemplate.require_follow && (
                <div style={{
                  background: '#f0fdf4',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  border: '1px solid #bbf7d0',
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Lock size={12} /> 2. Follow-to-Unlock Gate Dispatched
                  </div>
                  <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.4 }}>
                    {previewTemplate.follow_prompt_message || "Hey! Please follow our page first to unlock your access! Tap \"✅ I've Followed\" below 🚀"}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', background: '#ffffff', border: '1px solid #bbf7d0', color: '#1e293b', fontWeight: 600 }}>
                      👉 Follow Profile
                    </span>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', background: '#16a34a', color: '#ffffff', fontWeight: 700 }}>
                      ✅ I've Followed
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Delivered Rich Instagram DM Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '12px',
                border: '1.5px solid #6366f1',
                boxShadow: '0 4px 14px rgba(99,102,241,0.12)',
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} /> 3. Delivered Instagram DM Card
                </div>

                {/* The actual visual card inside DM */}
                <div style={{
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  background: '#ffffff'
                }}>
                  <div style={{ height: '140px', background: '#0f172a', position: 'relative' }}>
                    <img
                      src={previewTemplate.card_image_url}
                      alt="Card"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      Airvix Card
                    </div>
                  </div>

                  <div style={{ padding: '12px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                      {previewTemplate.card_title}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4, marginBottom: '12px' }}>
                      {previewTemplate.card_subtitle}
                    </div>

                    <a
                      href={previewTemplate.card_button_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'block',
                        background: '#2563eb',
                        color: '#ffffff',
                        textAlign: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '12px',
                        textDecoration: 'none'
                      }}
                    >
                      {previewTemplate.card_button_text}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom CTA */}
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff'
            }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Stat: <span style={{ fontWeight: 700, color: '#0f172a' }}>{previewTemplate.stats}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleUseTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 700 }}
              >
                🚀 Use This Card Template
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TARGET MEDIA SELECTION PROMPT MODAL */}
      {targetPromptOpen && pendingTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10500,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Where do you want to apply this automation? 🎯
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Selecting target content for: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>"{pendingTemplate.name}"</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTargetPromptOpen(false);
                  setPendingTemplate(null);
                }}
                style={{
                  border: 'none',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 3 Target Options */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              flex: 1,
            }}>
              {/* Option 1: Next Upload (Future Content) */}
              <div
                onClick={() => setTargetSelectionMode('next')}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '2px solid',
                  borderColor: targetSelectionMode === 'next' ? '#2563eb' : 'var(--border-light)',
                  background: targetSelectionMode === 'next' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: targetSelectionMode === 'next' ? '0 4px 14px rgba(37,99,235,0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: targetSelectionMode === 'next' ? '#2563eb' : 'var(--border-subtle)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Film size={17} />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: targetSelectionMode === 'next' ? '#1e3a8a' : 'var(--text-main)' }}>
                      🚀 Next Reel / Post You Upload
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#2563eb',
                    color: '#ffffff',
                  }}>
                    ✨ RECOMMENDED FOR LAUNCHES
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: targetSelectionMode === 'next' ? '#1e40af' : 'var(--text-muted)', margin: '0 0 0 42px', lineHeight: 1.45 }}>
                  Automatically attaches to your <b>next uploaded Reel or Post</b>. Perfect when preparing automation before publishing new content on Instagram.
                </p>
              </div>

              {/* Option 2: Previous / Existing Reel or Post */}
              <div
                onClick={() => setTargetSelectionMode('previous')}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '2px solid',
                  borderColor: targetSelectionMode === 'previous' ? '#8b5cf6' : 'var(--border-light)',
                  background: targetSelectionMode === 'previous' ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: targetSelectionMode === 'previous' ? '0 4px 14px rgba(139,92,246,0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: targetSelectionMode === 'previous' ? '#8b5cf6' : 'var(--border-subtle)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Play size={16} fill="#fff" />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: targetSelectionMode === 'previous' ? '#4c1d95' : 'var(--text-main)' }}>
                      🎬 A Previous Reel or Post
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#8b5cf6',
                    color: '#ffffff',
                  }}>
                    🖼️ EXISTING CONTENT
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: targetSelectionMode === 'previous' ? '#5b21b6' : 'var(--text-muted)', margin: '0 0 10px 42px', lineHeight: 1.45 }}>
                  Select an existing Reel or Post from your connected Instagram profile.
                </p>

                {/* If 'previous' is selected, show embedded Reel selector */}
                {targetSelectionMode === 'previous' && (
                  <div style={{ marginLeft: '42px', marginTop: '10px' }}>
                    {loadingReels ? (
                      <div style={{ fontSize: '12px', color: '#6d28d9', fontStyle: 'italic' }}>
                        Loading your Instagram Reels...
                      </div>
                    ) : reels && reels.length > 0 ? (
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#5b21b6', marginBottom: '8px' }}>
                          Select your Reel ({reels.length} available):
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: '10px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          paddingRight: '4px'
                        }}>
                          {reels.map((reel) => {
                            const isReelPicked = selectedPreviousReel?.id === reel.id;
                            const thumb = reel.thumbnail_url || reel.media_url;
                            return (
                              <div
                                key={reel.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPreviousReel(reel);
                                }}
                                style={{
                                  borderRadius: '10px',
                                  border: isReelPicked ? '2.5px solid #7c3aed' : '1px solid #c4b5fd',
                                  background: '#ffffff',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  boxShadow: isReelPicked ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                                }}
                              >
                                <div style={{ height: '70px', background: '#0f172a', position: 'relative' }}>
                                  {thumb ? (
                                    <img 
                                      src={thumb} 
                                      alt="Reel" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                      <Film size={20} />
                                    </div>
                                  )}
                                  {isReelPicked && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '4px',
                                      right: '4px',
                                      background: '#7c3aed',
                                      color: '#fff',
                                      borderRadius: '50%',
                                      width: '18px',
                                      height: '18px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <Check size={12} />
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: '6px', fontSize: '10.5px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                  {reel.caption || (reel.id ? `Reel #${reel.id.slice(-4)}` : 'Reel')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#6d28d9', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                        No published Reels found on this account yet. You can choose <b>Next Reel Upload</b> or <b>All Content</b> instead!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Option 3: All Current & Future Content (Profile-Wide) */}
              <div
                onClick={() => setTargetSelectionMode('all')}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '2px solid',
                  borderColor: targetSelectionMode === 'all' ? '#06b6d4' : 'var(--border-light)',
                  background: targetSelectionMode === 'all' ? 'linear-gradient(135deg, #ecfeff 0%, #cff4fc 100%)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: targetSelectionMode === 'all' ? '0 4px 14px rgba(6,182,212,0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: targetSelectionMode === 'all' ? '#06b6d4' : 'var(--border-subtle)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Layers size={17} />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: targetSelectionMode === 'all' ? '#155e75' : 'var(--text-main)' }}>
                      🌐 All Reels &amp; Posts (Profile-Wide)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#06b6d4',
                    color: '#ffffff',
                  }}>
                    GLOBAL RULE
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: targetSelectionMode === 'all' ? '#0e7490' : 'var(--text-muted)', margin: '0 0 0 42px', lineHeight: 1.45 }}>
                  Triggers whenever anyone comments the keyword on <b>ANY current or future Reel or Post</b> across your entire Instagram account.
                </p>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-card)',
            }}>
              <button
                type="button"
                onClick={() => {
                  setTargetPromptOpen(false);
                  setPendingTemplate(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmTargetSelection}
                style={{
                  padding: '10px 22px',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                <span>Continue &amp; Customize Rule</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDITOR & BUILDER MODAL */}
      <TemplateEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingTemplate(null);
        }}
        templateToEdit={editingTemplate}
        onTemplateSaved={() => {
          loadDynamicTemplates();
        }}
        onOpenCreateRule={onOpenCreateRule}
        accountId={account?.id}
      />
    </div>
  );
}

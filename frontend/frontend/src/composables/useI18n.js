import { ref, computed } from 'vue'

const STORAGE_KEY = 'sahlify-lang'
const SUPPORTED_LANGS = ['en', 'fr', 'ar']

function getInitialLang() {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_LANGS.includes(saved)) return saved
  } catch {
    // ignore
  }
  return 'en'
}

const lang = ref(getInitialLang())

function applyLang(value) {
  const next = SUPPORTED_LANGS.includes(value) ? value : 'en'
  lang.value = next
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', next)
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr')
  }
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore storage errors
  }
}

applyLang(lang.value)

const messages = {
  en: {
    nav: {
      home: 'Home',
      docs: 'Docs',
      pricing: 'Pricing',
      signIn: 'Sign In',
      dashboard: 'Dashboard',
      signOut: 'Sign Out',
      myStores: 'My Stores',
      selectStore: 'Select a store...',
      admin: 'Admin',
      documentation: 'Documentation →',
      terms: 'Terms',
      privacy: 'Privacy',
      contact: 'Contact',
    },
    theme: {
      dark: 'Dark',
      light: 'Light',
      toDark: 'Switch to dark mode',
      toLight: 'Switch to light mode',
    },
    landing: {
      badge: 'Open-Source Algerian E-Commerce Platform',
      title: 'Build and scale your Algerian online store without the complexity.',
      subtitle:
        'Sahlify gives you everything needed to sell across all 69 wilayas: Cash on Delivery, Chargily Edahabia/CIB, express carrier dispatch, AI store themes, and Meta CAPI tracking on real delivery.',
      selfHost: 'Self Host',
      cloud: 'Cloud',
      heroNotePre: 'Choose',
      heroNoteMid: 'to run free on your own server with Docker, or',
      heroNotePost: 'for instant managed hosting.',
      featuresTitle: 'Built specifically for Algerian merchants',
      featuresSubtitle: 'Simple tools that work out of the box—no bloated plugins required.',
      features: [
        {
          title: 'COD & Chargily DZD Payments',
          desc: 'Accept Cash on Delivery with phone blacklist protection or online payments via Edahabia & CIB with Chargily Pay.',
        },
        {
          title: '69 Wilayas & 10+ Express Carriers',
          desc: 'Pre-seeded with all 69 Algerian wilayas and built-in adapters for Yalidine, Guepex, ZR Express, Maystro, Noest, and Ecotrack.',
        },
        {
          title: 'AI Storefront Designer',
          desc: 'Generate or customize Arabic, French, and English store themes and persuasive product copy in seconds.',
        },
        {
          title: 'Meta CAPI on Delivery',
          desc: 'Fires server-side Lead events at checkout and Purchase events automatically when the carrier marks a shipment delivered.',
        },
      ],
      selfHostedTitle: 'Self-Hosted Edition',
      selfHostedBadge: 'AGPL-3.0 • Free',
      selfHostedDesc:
        'Deploy the entire stack on your own VPS with Docker Compose. Full control over your database, zero platform fees, and optional bring-your-own AI API key.',
      selfHostedBtn: 'Read Self-Host Docs →',
      cloudTitle: 'Sahlify Cloud',
      cloudBadge: 'Managed SaaS',
      cloudDesc:
        'Launch your store in under a minute. Includes automatic SSL for custom domains, included monthly AI theme generations, and simple DZD billing via Chargily.',
      cloudBtn: 'View Cloud Pricing →',
      footerText: 'Sahlify — Algerian E-Commerce Store Builder',
      merchantSignIn: 'Merchant Sign In',
    },
    auth: {
      signInTab: 'Sign In',
      registerTab: 'Create Account',
      welcomeBack: 'Welcome back',
      createAccountTitle: 'Create your merchant account',
      signInSub: 'Sign in to manage your stores, orders, and shipments.',
      registerSub: 'Get started with Sahlify in seconds.',
      fullName: 'Full Name',
      email: 'Email Address',
      password: 'Password',
      passwordPlaceholder: 'Minimum 8 characters',
      pleaseWait: 'Please wait...',
      continueWithGoogle: 'Continue with Google',
      or: 'or',
    },
    pricing: {
      badge: 'Simple, Transparent Pricing in DZD',
      title: 'Choose how you want to run Sahlify',
      subtitle:
        'Pay in Algerian Dinars with Edahabia or CIB via Chargily on Cloud, or self-host for free.',
      cloudBadge: 'Sahlify Cloud',
      cloudDesc:
        'Fully managed store hosting with instant setup, automatic SSL custom domains, and AI store customization included.',
      cloudCta: 'Start with Sahlify Cloud →',
      selfHostedBadge: 'Open Source (AGPL-3.0)',
      selfHostedTitle: 'Self-Hosted',
      selfHostedPrice: '0 DZD',
      selfHostedPeriod: '/ forever',
      selfHostedDesc:
        'Run Sahlify on your own VPS or server using Docker Compose with complete control over your data and infrastructure.',
      selfHostedCta: 'Read Self-Host Docs →',
    },
    docs: {
      sidebarTitle: 'Self-Hosting Guide',
      openDashboard: 'Open Dashboard →',
      preferCloud: 'Prefer Managed Cloud?',
      badge: 'Self-Hosted Documentation',
      title: 'Self-Hosting Sahlify',
    },
    sidebar: {
      products: 'Products',
      orders: 'Orders & Blacklist',
      shipping: 'Shipping & Rates',
      themes: 'Themes & AI',
      integrations: 'Integrations & CAPI',
      billing: 'Billing',
      settings: 'Store Settings',
    },
  },
  fr: {
    nav: {
      home: 'Accueil',
      docs: 'Docs',
      pricing: 'Tarifs',
      signIn: 'Connexion',
      dashboard: 'Tableau de bord',
      signOut: 'Déconnexion',
      myStores: 'Mes Boutiques',
      selectStore: 'Choisir une boutique...',
      admin: 'Admin',
      documentation: 'Documentation →',
      terms: 'Conditions',
      privacy: 'Confidentialité',
      contact: 'Contact',
    },
    theme: {
      dark: 'Sombre',
      light: 'Clair',
      toDark: 'Passer au mode sombre',
      toLight: 'Passer au mode clair',
    },
    landing: {
      badge: 'Plateforme E-Commerce Algérienne Open-Source',
      title: 'Créez et développez votre boutique en ligne en Algérie sans complexité.',
      subtitle:
        'Sahlify vous offre tout le nécessaire pour vendre dans les 69 wilayas : paiement à la livraison (COD), Chargily Edahabia/CIB, expédition express, thèmes IA et suivi Meta CAPI à la livraison.',
      selfHost: 'Auto-hébergement',
      cloud: 'Cloud',
      heroNotePre: 'Choisissez',
      heroNoteMid: 'pour héberger gratuitement avec Docker, ou',
      heroNotePost: 'pour un hébergement géré instantané.',
      featuresTitle: 'Conçu pour les e-commerçants algériens',
      featuresSubtitle: 'Des outils simples et prêts à l’emploi, sans plugins superflus.',
      features: [
        {
          title: 'Paiement COD & Chargily DZD',
          desc: 'Acceptez le paiement à la livraison avec liste noire de numéros ou en ligne via Edahabia & CIB avec Chargily Pay.',
        },
        {
          title: '69 Wilayas & 10+ Transporteurs',
          desc: 'Préconfiguré avec les 69 wilayas et intégrations natives pour Yalidine, Guepex, ZR Express, Maystro, Noest et Ecotrack.',
        },
        {
          title: 'Designer de Boutique IA',
          desc: 'Générez ou personnalisez des thèmes en arabe, français et anglais ainsi que vos fiches produits en quelques secondes.',
        },
        {
          title: 'Meta CAPI à la Livraison',
          desc: 'Envoie les événements Lead côté serveur à la commande et Purchase automatiquement lorsque le colis est livré.',
        },
      ],
      selfHostedTitle: 'Édition Auto-hébergée',
      selfHostedBadge: 'AGPL-3.0 • Gratuit',
      selfHostedDesc:
        'Déployez toute la stack sur votre propre VPS avec Docker Compose. Contrôle total de vos données, zéro commission et clé IA optionnelle.',
      selfHostedBtn: 'Lire la doc Auto-hébergement →',
      cloudTitle: 'Sahlify Cloud',
      cloudBadge: 'SaaS Géré',
      cloudDesc:
        'Lancez votre boutique en moins d’une minute. SSL automatique pour domaines personnalisés, générations IA incluses et facturation simple en DZD via Chargily.',
      cloudBtn: 'Voir les tarifs Cloud →',
      footerText: 'Sahlify — Créateur de Boutiques E-Commerce Algériennes',
      merchantSignIn: 'Espace Marchand',
    },
    auth: {
      signInTab: 'Connexion',
      registerTab: 'Créer un compte',
      welcomeBack: 'Bon retour',
      createAccountTitle: 'Créer votre compte marchand',
      signInSub: 'Connectez-vous pour gérer vos boutiques, commandes et livraisons.',
      registerSub: 'Démarrez avec Sahlify en quelques secondes.',
      fullName: 'Nom complet',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      passwordPlaceholder: 'Minimum 8 caractères',
      pleaseWait: 'Veuillez patienter...',
      continueWithGoogle: 'Continuer avec Google',
      or: 'ou',
    },
    pricing: {
      badge: 'Tarifs simples et transparents en DZD',
      title: 'Choisissez votre mode d’utilisation',
      subtitle:
        'Payez en Dinars Algériens avec Edahabia ou CIB via Chargily sur Cloud, ou auto-hébergez gratuitement.',
      cloudBadge: 'Sahlify Cloud',
      cloudDesc:
        'Hébergement géré avec configuration instantanée, SSL automatique et personnalisation IA incluse.',
      cloudCta: 'Démarrer sur Sahlify Cloud →',
      selfHostedBadge: 'Open Source (AGPL-3.0)',
      selfHostedTitle: 'Auto-hébergé',
      selfHostedPrice: '0 DZD',
      selfHostedPeriod: '/ à vie',
      selfHostedDesc:
        'Exécutez Sahlify sur votre propre VPS avec Docker Compose en gardant le contrôle total sur vos données.',
      selfHostedCta: 'Lire la doc Auto-hébergement →',
    },
    docs: {
      sidebarTitle: 'Guide Auto-hébergement',
      openDashboard: 'Ouvrir le tableau de bord →',
      preferCloud: 'Préférez le Cloud géré ?',
      badge: 'Documentation Auto-hébergement',
      title: 'Auto-héberger Sahlify',
    },
    sidebar: {
      products: 'Produits',
      orders: 'Commandes & Liste noire',
      shipping: 'Livraison & Tarifs',
      themes: 'Thèmes & IA',
      integrations: 'Intégrations & CAPI',
      billing: 'Facturation',
      settings: 'Paramètres',
    },
  },
  ar: {
    nav: {
      home: 'الرئيسية',
      docs: 'التوثيق',
      pricing: 'الأسعار',
      signIn: 'تسجيل الدخول',
      dashboard: 'لوحة التحكم',
      signOut: 'تسجيل الخروج',
      myStores: 'متاجري',
      selectStore: 'اختر متجراً...',
      admin: 'الإدارة',
      documentation: 'التوثيق ←',
      terms: 'الشروط',
      privacy: 'الخصوصية',
      contact: 'اتصل بنا',
    },
    theme: {
      dark: 'داكن',
      light: 'فاتح',
      toDark: 'التبديل إلى الوضع الداكن',
      toLight: 'التبديل إلى الوضع الفاتح',
    },
    landing: {
      badge: 'منصة تجارة إلكترونية جزائرية مفتوحة المصدر',
      title: 'أنشئ متجرك الإلكتروني الجزائري وطوّره بكل بساطة.',
      subtitle:
        'توفر لك ساهليفاي كل ما تحتاجه للبيع عبر 69 ولاية: الدفع عند الاستلام، الدفع الإلكتروني عبر Chargily (الذهبية وCIB)، شركات التوصيل السريع، تصميم المتجر بالذكاء الاصطناعي، وتتبع Meta CAPI عند التوصيل.',
      selfHost: 'الاستضافة الذاتية',
      cloud: 'السحابة',
      heroNotePre: 'اختر',
      heroNoteMid: 'لتشغيل المنصة مجاناً على خادمك عبر Docker، أو',
      heroNotePost: 'للاستضافة السحابية الفورية.',
      featuresTitle: 'مصممة خصيصاً للتجار الجزائريين',
      featuresSubtitle: 'أدوات بسيطة تعمل مباشرة دون إضافات معقدة.',
      features: [
        {
          title: 'الدفع عند الاستلام و Chargily DZD',
          desc: 'اقبل الدفع عند الاستلام مع حماية القائمة السوداء للأرقام، أو الدفع الإلكتروني بالبطاقة الذهبية وCIB عبر Chargily Pay.',
        },
        {
          title: '69 ولاية وأكثر من 10 شركات توصيل',
          desc: 'قاعدة بيانات جاهزة لـ 69 ولاية مع ربط مباشر بشركات ياليدين، غيبيكس، ZR Express، مايسترو، نويست وEcotrack.',
        },
        {
          title: 'مصمم متاجر بالذكاء الاصطناعي',
          desc: 'أنشئ أو عدّل قوالب متجرك بالعربية والفرنسية والإنجليزية واكتب وصف المنتجات في ثوانٍ.',
        },
        {
          title: 'تتبع Meta CAPI عند التوصيل',
          desc: 'إرسال أحداث Lead من الخادم عند الطلب، وأحداث Purchase تلقائياً عند تأكيد شركة التوصيل تسليم الطلب.',
        },
      ],
      selfHostedTitle: 'نسخة الاستضافة الذاتية',
      selfHostedBadge: 'AGPL-3.0 • مجاني',
      selfHostedDesc:
        'انشر المنصة كاملة على خادمك الخاص عبر Docker Compose مع تحكم كامل بقاعدة البيانات وبدون أي عمولات.',
      selfHostedBtn: 'قراءة دليل الاستضافة الذاتية ←',
      cloudTitle: 'ساهليفاي السحابية',
      cloudBadge: 'خدمة مُدارة',
      cloudDesc:
        'أطلق متجرك في أقل من دقيقة مع شهادة SSL تلقائية للنطاقات المخصصة، ورصيد ذكاء اصطناعي شهري، وفوترة بسيطة بالدينار عبر Chargily.',
      cloudBtn: 'عرض أسعار السحابة ←',
      footerText: 'ساهليفاي — منصة بناء المتاجر الإلكترونية الجزائرية',
      merchantSignIn: 'دخول التجار',
    },
    auth: {
      signInTab: 'تسجيل الدخول',
      registerTab: 'إنشاء حساب',
      welcomeBack: 'مرحباً بعودتك',
      createAccountTitle: 'أنشئ حساب التاجر الخاص بك',
      signInSub: 'سجّل الدخول لإدارة متاجرك وطلباتك وشحناتك.',
      registerSub: 'ابدأ مع ساهليفاي في ثوانٍ.',
      fullName: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      passwordPlaceholder: '8 أحرف على الأقل',
      pleaseWait: 'يرجى الانتظار...',
      continueWithGoogle: 'المتابعة باستخدام Google',
      or: 'أو',
    },
    pricing: {
      badge: 'أسعار بسيطة وشفافة بالدينار الجزائري',
      title: 'اختر الطريقة التي تناسبك',
      subtitle:
        'ادفع بالدينار الجزائري بالبطاقة الذهبية أو CIB عبر Chargily على السحابة، أو استضفها مجاناً.',
      cloudBadge: 'ساهليفاي السحابية',
      cloudDesc: 'استضافة مُدارة بالكامل مع إعداد فوري، وSSL تلقائي، وتخصيص بالذكاء الاصطناعي.',
      cloudCta: 'ابدأ مع ساهليفاي السحابية ←',
      selfHostedBadge: 'مفتوح المصدر (AGPL-3.0)',
      selfHostedTitle: 'الاستضافة الذاتية',
      selfHostedPrice: '0 دج',
      selfHostedPeriod: '/ مدى الحياة',
      selfHostedDesc:
        'شغّل ساهليفاي على خادمك الخاص عبر Docker Compose مع تحكم كامل في بياناتك.',
      selfHostedCta: 'قراءة دليل الاستضافة الذاتية ←',
    },
    docs: {
      sidebarTitle: 'دليل الاستضافة الذاتية',
      openDashboard: 'فتح لوحة التحكم ←',
      preferCloud: 'تفضل السحابة المُدارة؟',
      badge: 'توثيق الاستضافة الذاتية',
      title: 'الاستضافة الذاتية لـ Sahlify',
    },
    sidebar: {
      products: 'المنتجات',
      orders: 'الطلبات والقائمة السوداء',
      shipping: 'الشحن والأسعار',
      themes: 'القوالب والذكاء الاصطناعي',
      integrations: 'الربط و Meta CAPI',
      billing: 'الفوترة',
      settings: 'إعدادات المتجر',
    },
  },
}

export function useI18n() {
  const t = computed(() => messages[lang.value] || messages.en)
  const isRtl = computed(() => lang.value === 'ar')

  function setLang(next) {
    applyLang(next)
  }

  return {
    lang,
    t,
    isRtl,
    setLang,
  }
}

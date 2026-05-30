// ─────────────────────────────────────────────────────────────
//  TRANSLATIONS  –  Hebrew (he) | English (en)
// ─────────────────────────────────────────────────────────────

const translations = {
  he: {
    dir: 'rtl',
    lang: 'he',

    // ── NAV ──────────────────────────────────────────────────
    nav: {
      home:        'דף הבית',
      requests:    'הגשת בקשה',
      directory:   'מדריך קהילה',
      volunteers:  'התנדבות',
      about:       'אודות',
      contact:     'צור קשר',
      faq:         'שאלות נפוצות',
      track:       'מעקב בקשה',
      admin:       'ניהול',
      submitBtn:   '+ הגש בקשה',
      openMenu:    'פתח תפריט',
      closeMenu:   'סגור תפריט',
    },

    // ── HOME HERO ─────────────────────────────────────────────
    hero: {
      badge:     '✦ עמותה רשומה • ייעוץ חינם • ישראל ואתיופיה',
      title1:    'כי כל אחד',
      titleHighlight: 'ראוי',
      title2:    'להגשים את עצמו',
      subtitle:  'עמותת דחיפה להגשמה מלווה את בני הקהילה האתיופית בישראל בחינוך, תעסוקה, סיוע משפטי ושילוב חברתי. אנחנו כאן בשבילך.',
      cta:       'הגש בקשת סיוע',
      ctaSecondary: 'השירותים שלנו',
      stats: {
        beneficiaries: 'נהנו מהשירות',
        volunteers:    'מתנדבים פעילים',
        satisfaction:  'שביעות רצון',
        years:         'שנות פעילות',
      },
    },

    // ── SERVICES ──────────────────────────────────────────────
    services: {
      title:   'אזורי הפעילות שלנו',
      subtitle:'אנו מספקים סיוע מקצועי בארבעה תחומים עיקריים לבני הקהילה',
      items: {
        education: {
          title: 'חינוך ולמידה',
          desc:  'תמיכה בבחינות בגרות, מלגות אקדמיות, קידום השכלה גבוהה וחניכה אישית.',
        },
        employment: {
          title: 'תעסוקה וקריירה',
          desc:  'הכשרות מקצועיות, כתיבת קורות חיים, הכנה לראיונות וחיבור למעסיקים.',
        },
        legal: {
          title: 'ייעוץ משפטי',
          desc:  'סיוע בנושאי מעמד, אזרחות, זכויות עובדים ופנייה לרשויות המדינה.',
        },
        social: {
          title: 'שילוב חברתי',
          desc:  'קבוצות תמיכה, פעילויות קהילתיות וחיבור לשירותי רווחה ומשאבים.',
        },
      },
    },

    // ── STORIES ───────────────────────────────────────────────
    stories: {
      title:   'סיפורי הצלחה',
      subtitle:'מה אומרים המטופלים שלנו',
    },

    // ── CTA SECTION ───────────────────────────────────────────
    cta: {
      title:    'מוכנים לצעד הבא?',
      subtitle: 'צוות העמותה זמין לסייע. הגש בקשה עכשיו ונחזור אליך תוך 48 שעות.',
      primary:  'הגש בקשת סיוע עכשיו',
      secondary:'הצטרף כמתנדב',
    },

    // ── PARTNERS ──────────────────────────────────────────────
    partners: {
      title: 'ארגוני שותפים',
    },

    // ── REQUEST FORM ──────────────────────────────────────────
    request: {
      pageTitle:   'הגשת בקשת סיוע',
      pageSubtitle:'מלא את הטופס ונציג יצור איתך קשר תוך 48 שעות',
      steps: {
        personal:   'פרטים אישיים',
        type:       'סוג הבקשה',
        documents:  'מסמכים',
        confirm:    'אישור',
      },
      step1: {
        title:       'פרטים אישיים',
        firstName:   'שם פרטי',
        lastName:    'שם משפחה',
        idNumber:    'תעודת זהות',
        phone:       'מספר טלפון',
        email:       'דואר אלקטרוני',
        city:        'עיר מגורים',
        age:         'גיל',
        gender:      'מין',
        genderM:     'זכר',
        genderF:     'נקבה',
        genderO:     'אחר',
        firstNamePH: 'ישראל',
        lastNamePH:  'ישראלי',
        idPH:        '000000000',
        phonePH:     '050-0000000',
        emailPH:     'example@email.com',
        agePH:       '25',
        required:    '* שדות חובה',
      },
      step2: {
        title:       'במה נוכל לסייע?',
        subtitle:    'בחר את קטגוריית הסיוע המתאימה לצרכיך',
        description: 'תיאור הבקשה',
        descPH:      'פרט את הצורך שלך בכמה מילים...',
        urgency:     'רמת דחיפות',
        urgencyLow:  'רגיל — תוך שבועיים',
        urgencyMed:  'בינוני — תוך שבוע',
        urgencyHigh: 'דחוף — תוך 48 שעות',
        cats: {
          education: { label: 'חינוך ולמידה', hint: 'מלגות, בגרויות, לימודים גבוהים' },
          employment:{ label: 'תעסוקה וקריירה', hint: 'קורות חיים, ראיונות, הכשרות' },
          legal:     { label: 'ייעוץ משפטי', hint: 'מעמד, אזרחות, זכויות' },
          social:    { label: 'שילוב חברתי', hint: 'קהילה, רווחה, תמיכה' },
        },
      },
      step3: {
        title:         'העלאת מסמכים',
        subtitle:      'יש לצרף תעודת זהות ומסמכים רלוונטיים לבקשה',
        idLabel:       'תעודת זהות (חובה)',
        idHint:        'גרור קובץ לכאן או לחץ לבחירה',
        idFormats:     'JPG, PNG, PDF • עד 5MB',
        supportLabel:  'מסמכים תומכים (אופציונלי)',
        supportHint:   'תעודות לימוד, חוזה עבודה, מסמכים משפטיים',
        supportFormats:'JPG, PNG, PDF • עד 10MB לכל קובץ',
        security:      '🔒 כל המסמכים מועברים בצפנה מלאה ונשמרים בשרתים מאובטחים בלבד',
        uploaded:      'הועלה בהצלחה',
        uploading:     'מעלה...',
        remove:        'הסר',
      },
      step4: {
        title:       'סיכום ואישור הבקשה',
        fullName:    'שם מלא',
        phone:       'טלפון',
        city:        'עיר',
        category:    'קטגוריה',
        description: 'תיאור',
        urgency:     'דחיפות',
        consent:     'אני מאשר/ת כי המידע שמסרתי הוא נכון ומדויק ומסכים/ה למדיניות הפרטיות ותנאי השימוש של העמותה.',
      },
      success: {
        title:       'הבקשה נשלחה בהצלחה!',
        subtitle:    'קיבלנו את בקשתך. נציג יצור איתך קשר תוך 48 שעות. שמור את מספר המעקב:',
        backHome:    'חזרה לדף הבית',
        trackBtn:    'מעקב אחר הבקשה',
      },
      nav: {
        next: 'המשך',
        back: 'חזור',
        submit: 'שלח בקשה',
      },
      validation: {
        required:    'שדה זה הוא חובה',
        invalidId:   'תעודת זהות חייבת להכיל 9 ספרות',
        invalidPhone:'מספר טלפון לא תקין',
        invalidEmail:'כתובת אימייל לא תקינה',
        selectCity:  'יש לבחור עיר',
        selectCat:   'יש לבחור קטגוריה',
        needDesc:    'יש לתאר את הבקשה',
        needConsent: 'יש לאשר את התנאים להמשך',
        needId:      'יש להעלות תעודת זהות',
      },
      cities: ['תל אביב','חיפה','ירושלים','באר שבע','נתניה','אשדוד','ראשון לציון','רמלה','לוד','פתח תקווה','בני ברק','הרצליה','כפר סבא','רעננה','אחר'],
    },

    // ── DIRECTORY ─────────────────────────────────────────────
    directory: {
      pageTitle:   'מדריך קהילה ועסקים',
      pageSubtitle:'מאגר עסקים קהילתיים ורשימת ארגוני שותפים',
      tabBusiness: 'עסקים קהילתיים',
      tabNGO:      'ארגוני שותפים',
      searchPH:    'חפש עסק, שם, שירות...',
      searchNGO:   'חפש ארגון, תחום פעילות...',
      filterAll:   'הכל',
      noResults:   'לא נמצאו תוצאות',
      noResultsHint:'נסה לשנות את מונחי החיפוש',
      registerBiz: 'רשם את העסק שלך',
      referBtn:    'הפנה בקשה לארגון',
      moreBtn:     'פרטים נוספים',
      categories:  { food:'מזון', services:'שירותים', health:'בריאות', education:'חינוך', beauty:'יופי וטיפוח', tech:'טכנולוגיה' },
      ngoAreas:    { all:'הכל', education:'חינוך', employment:'תעסוקה', legal:'משפטי', social:'חברתי', housing:'דיור' },
      smartSuggest:'⚡ הבקשה שלך עשויה להתאים גם לארגונים אלו',
    },

    // ── VOLUNTEERS ────────────────────────────────────────────
    volunteers: {
      pageTitle:    'מתנדבים',
      pageSubtitle: 'הצטרף לצוות המתנדבים שלנו ועזור לקהילה',
      registerTitle:'הרשמה כמתנדב',
      registerSub:  'מלא את הפרטים ונציג יצור איתך קשר לתיאום',
      activeTitle:  'מתנדבים פעילים',
      activeSub:    'מתנדבים תומכים בקהילה',
      form: {
        fullName:   'שם מלא',
        profession: 'מקצוע / תחום התמחות',
        profPH:     'עו״ד, מהנדס, מורה...',
        areas:      'תחומי התנדבות',
        availability:'זמינות שבועית',
        avail1:     '2-4 שעות בשבוע',
        avail2:     '4-8 שעות בשבוע',
        avail3:     '8+ שעות בשבוע',
        submitBtn:  'הגש הרשמה כמתנדב',
        areasList:  ['חינוך וחניכה','ייעוץ משפטי','תעסוקה','שילוב חברתי','בריאות ורווחה','יזמות ועסקים'],
      },
      available: 'זמין לשיוך',
    },

    // ── ADMIN ─────────────────────────────────────────────────
    admin: {
      title:      'לוח ניהול',
      dashboard:  'סקירה כללית',
      requests:   'בקשות',
      users:      'משתמשים',
      volunteers: 'מתנדבים',
      businesses: 'עסקים',
      analytics:  'אנליטיקה',
      lastUpdate: 'עדכון אחרון',
      today:      'היום',
      stats: {
        openRequests:  'בקשות פתוחות',
        totalHelped:   'סה״כ מטופלים',
        activeVol:     'מתנדבים פעילים',
        satisfaction:  'שביעות רצון',
        thisMonth:     'החודש',
        thisYear:      'השנה',
      },
      table: {
        requestId:   'מס׳ בקשה',
        name:        'שם מגיש',
        category:    'קטגוריה',
        city:        'עיר',
        status:      'סטטוס',
        date:        'תאריך',
        actions:     'פעולות',
        email:       'אימייל',
        requests:    'בקשות',
        joined:      'הצטרף',
        skills:      'תחום',
        assignment:  'שיוך נוכחי',
        available:   'זמינות',
        approve:     'אשר',
        reject:      'דחה',
        edit:        'עריכה',
        delete:      'מחיקה',
        assign:      'שייך',
        view:        'צפה',
        addRequest:  '+ בקשה חדשה',
        addUser:     '+ הוסף משתמש',
        export:      'ייצא CSV',
      },
      charts: {
        byCategory:  'בקשות לפי קטגוריה (החודש)',
        byCity:      'בקשות לפי עיר',
        trend:       'מגמת בקשות — 6 חודשים אחרונים',
      },
    },

    // ── TRACK REQUEST ─────────────────────────────────────────
    track: {
      pageTitle:   'מעקב אחר בקשה',
      pageSubtitle:'הזן את מספר המעקב שלך לבדיקת הסטטוס',
      placeholder: 'PFF-2024-XXXXX',
      searchBtn:   'בדוק סטטוס',
      notFound:    'לא נמצאה בקשה עם מספר זה',
      notFoundHint:'בדוק שהמספר שהזנת נכון ונסה שוב',
      timeline: {
        submitted:  'הבקשה הוגשה',
        reviewing:  'הבקשה בבדיקה',
        approved:   'הבקשה אושרה',
        inProgress: 'בטיפול פעיל',
        completed:  'הטיפול הושלם',
      },
      info: {
        number:   'מספר בקשה',
        category: 'קטגוריה',
        submitted:'תאריך הגשה',
        status:   'סטטוס נוכחי',
        handler:  'מטפל/ת',
        notes:    'הערות',
      },
    },

    // ── ABOUT ─────────────────────────────────────────────────
    about: {
      pageTitle:  'אודות העמותה',
      mission:    'המשימה שלנו',
      missionText:'עמותת דחיפה להגשמה הוקמה על מנת לתמוך ולקדם את בני הקהילה האתיופית בישראל. אנו מאמינים כי לכל אדם מגיעה ההזדמנות להגשים את הפוטנציאל המלא שלו, ואנו כאן כדי להפוך את זה למציאות.',
      values:     'הערכים שלנו',
      team:       'הצוות שלנו',
      history:    'ההיסטוריה שלנו',
    },

    // ── CONTACT ───────────────────────────────────────────────
    contact: {
      pageTitle:   'צור קשר',
      pageSubtitle:'אנחנו כאן לכל שאלה, הצעה או בקשת מידע',
      form: {
        name:     'שם מלא',
        email:    'דואר אלקטרוני',
        subject:  'נושא',
        message:  'הודעה',
        messagePH:'כתוב את הודעתך כאן...',
        send:     'שלח הודעה',
        success:  'הודעתך נשלחה בהצלחה! נחזור אליך בקרוב.',
      },
      info: {
        phone:   'טלפון',
        email:   'אימייל',
        address: 'כתובת',
        hours:   'שעות פעילות',
        hoursVal:'א׳–ה׳ 9:00–18:00',
      },
    },

    // ── FAQ ───────────────────────────────────────────────────
    faq: {
      pageTitle:   'שאלות נפוצות',
      pageSubtitle:'תשובות לשאלות הנפוצות ביותר',
      searchPH:    'חפש שאלה...',
    },

    // ── STATUS LABELS ─────────────────────────────────────────
    status: {
      pending:    'ממתין לטיפול',
      review:     'בבדיקה',
      approved:   'אושר',
      rejected:   'נדחה',
      inProgress: 'בטיפול פעיל',
      completed:  'הושלם',
    },

    // ── COMMON ────────────────────────────────────────────────
    common: {
      loading:    'טוען...',
      save:       'שמור',
      cancel:     'ביטול',
      close:      'סגור',
      back:       'חזור',
      next:       'המשך',
      yes:        'כן',
      no:         'לא',
      search:     'חיפוש',
      filter:     'סינון',
      all:        'הכל',
      new:        'חדש',
      required:   'חובה',
      optional:   'אופציונלי',
      noData:     'אין נתונים להצגה',
      error:      'שגיאה',
      success:    'הצלחה',
      copy:       'העתק',
      copied:     'הועתק!',
      print:      'הדפס',
      export:     'ייצא',
      moreInfo:   'מידע נוסף',
      less:       'פחות',
      page:       'עמוד',
      of:         'מתוך',
      results:    'תוצאות',
      confirm:    'אישור',
      delete:     'מחיקה',
      deleteConfirm: 'האם אתה בטוח שברצונך למחוק?',
      or:         'או',
    },

    // ── FOOTER ────────────────────────────────────────────────
    footer: {
      tagline:    'מקדמים הגשמה עצמית לקהילה האתיופית בישראל',
      quickLinks: 'קישורים מהירים',
      services:   'שירותים',
      contact:    'צור קשר',
      legal:      'מידע משפטי',
      privacy:    'מדיניות פרטיות',
      terms:      'תנאי שימוש',
      accessibility: 'הצהרת נגישות',
      rights:     'כל הזכויות שמורות לעמותת דחיפה להגשמה',
      reg:        'עמותה רשומה בישראל • ח.פ. 58-1234567',
    },

    // ── 404 ───────────────────────────────────────────────────
    notFound: {
      title:   'הדף לא נמצא',
      subtitle:'הדף שחיפשת אינו קיים או הועבר למיקום אחר.',
      btn:     'חזרה לדף הבית',
    },

    // ── AUTH (CC-5) ───────────────────────────────────────────
    auth: {
      login: {
        title:        'התחברות',
        subtitle:     'התחבר/י לחשבון שלך כדי להגיש בקשה או לעקוב אחר בקשות קיימות.',
        email:        'אימייל',
        password:     'סיסמה',
        submit:       'התחבר',
        submitting:   'מתחבר...',
        noAccount:    'אין לך חשבון?',
        registerLink: 'הירשם/י כאן',
        error:        'התחברות נכשלה. בדוק/י את האימייל והסיסמה.',
      },
      register: {
        title:           'הרשמה',
        subtitle:        'צור/י חשבון חדש להגשת ומעקב אחר בקשות.',
        email:           'אימייל',
        password:        'סיסמה',
        confirmPassword: 'אישור סיסמה',
        submit:          'הירשם',
        submitting:      'יוצר חשבון...',
        haveAccount:     'יש לך כבר חשבון?',
        loginLink:       'התחבר/י כאן',
        passwordMismatch:'הסיסמאות אינן תואמות',
        passwordTooShort:'הסיסמה חייבת להכיל לפחות 6 תווים',
        error:           'הרשמה נכשלה. אנא נסה/י שוב.',
        emailInUse:      'אימייל זה כבר רשום במערכת.',
      },
      logout:           'התנתק',
      welcome:          'שלום',
    },

    // === Stream 3 (volunteer signup) ===
    volunteerSignup: {
      // Tab toggle on register page
      tabBeneficiary: 'נהנה מהשירות',
      tabVolunteer:   'מתנדב/ת',

      // Step 1 — account creation labels (reuses auth.register for email/pw)
      step1Title:     'פרטי חשבון',

      // Step 2 — volunteer details form
      step2Title:     'פרטי התנדבות',
      firstName:      'שם פרטי',
      lastName:       'שם משפחה',
      phone:          'מספר טלפון',
      email:          'דואר אלקטרוני',
      city:           'עיר מגורים',
      profession:     'מקצוע / תחום התמחות',
      professionPH:   'עו״ד, מהנדס, מורה...',
      areasOfHelp:    'תחומי התנדבות',
      languages:      'שפות',
      languagesPH:    'עברית, אמהרית, אנגלית...',
      availability:   'זמינות שבועית',
      avail24:        '2–4 שעות בשבוע',
      avail48:        '4–8 שעות בשבוע',
      avail8plus:     '8+ שעות בשבוע',
      motivation:     'מוטיבציה / הערות נוספות',
      motivationPH:   'ספר/י לנו קצת על עצמך...',
      consent:        'אני מאשר/ת את תנאי השימוש ומדיניות הפרטיות ומסכים/ה שפרטי יישמרו לצורך תיאום פעילות ההתנדבות.',
      areasList:      ['חינוך וחניכה', 'ייעוץ משפטי', 'תעסוקה', 'שילוב חברתי', 'בריאות ורווחה', 'יזמות ועסקים'],

      // Navigation
      nextStep:       'המשך לפרטי ההתנדבות',
      backStep:       'חזור לפרטי חשבון',
      submit:         'שלח הגשה כמתנדב',
      submitting:     'שולח...',

      // Errors
      minOneArea:     'יש לבחור לפחות תחום התנדבות אחד',
      minOneLang:     'יש לציין לפחות שפה אחת',
      consentRequired:'יש לאשר את התנאים',

      // Thanks page
      thanksTitle:    'תודה על ההגשה!',
      thanksSubtitle: 'קיבלנו את בקשתך להצטרף כמתנדב/ת. נציג יצור איתך קשר בקרוב לתיאום.',
      thanksBackHome: 'חזרה לדף הבית',
    },

    // ── MY REQUESTS (UC-01-e) ─────────────────────────────────
    myRequests: {
      navLink:  'הבקשות שלי',
      title:    'הבקשות שלי',
      subtitle: 'מעקב אחר הבקשות שהגשת',
      empty:    'עדיין לא הגשת בקשות.',
      submitCta:'הגש בקשה חדשה',
      loading:  'טוען את הבקשות שלך...',
      table: {
        id:          'מספר בקשה',
        category:    'קטגוריה',
        urgency:     'דחיפות',
        status:      'סטטוס',
        date:        'תאריך הגשה',
        attachments: 'מסמכים',
        deadline:    'מועד אחרון',
      },
      categories: {
        education:  'חינוך',
        employment: 'תעסוקה',
        legal:      'משפטי',
        social:     'חברתי',
      },
      urgencies: {
        low:    'רגיל',
        medium: 'בינוני',
        high:   'דחוף',
      },
      statuses: {
        pending:      'ממתין',
        inReview:     'בבדיקה',
        assigned:     'הוקצה',
        inProgress:   'בטיפול',
        resolved:     'הסתיים',
        rejected:     'נדחה',
        needsChanges: 'דורש תיקון',
      },
      // #68 — timeline
      timeline: {
        title:            'היסטוריית הבקשה',
        noEvents:         'אין אירועים עדיין',
        types: {
          created:          'הבקשה נוצרה',
          attachment_added: 'מסמך צורף',
          assigned:         'הוקצה מטפל',
          status_changed:   'הסטטוס עודכן',
          note_added:       'הוסף הערה',
          rated:            'דירוג נוסף',
        },
      },
      // #68 — deadline pill
      dueIn: (days) => days === 0 ? 'היום' : days < 0 ? `עבר לפני ${Math.abs(days)} ימים` : `בעוד ${days} ימים`,
      overdue: 'עבר המועד',
    },

    // === Stream 2 (UC-01 form) ===
    // Keys added by Stream 2 agent. Do not reorder or reformat existing keys.
    stream2: {
      // #66 — ID-type selector
      idType: {
        label:       'סוג מזהה',
        israeliId:   'תעודת זהות ישראלית',
        passport:    'דרכון / מסמך זר',
        none:        'ללא מסמך מזהה',
        noteLabel:   'הסבר (אופציונלי)',
        notePH:      'פרט מדוע אין תעודת זהות...',
      },
      // #67 — auto-fill
      autoFill: {
        fillBtn:        'מלא מהפרופיל שלי',
        saveToProfile:  'שמור פרטים לפרופיל',
        saved:          'הפרטים נשמרו בפרופיל',
        saveError:      'שמירת הפרופיל נכשלה',
        emailNote:      'ניתן לשנות את כתובת האימייל',
      },
      // #68 — deadline picker
      deadline: {
        label:  'מועד אחרון להסתיימות הטיפול (אופציונלי)',
        hint:   'השאר ריק אם אין מועד מוגדר',
      },
      // #90 — admin notice
      adminNotice: {
        title:    'חשבון ניהול מחובר',
        body:     'לא ניתן להגיש בקשה מחשבון מנהל. אנא עבור לחשבון מוטב.',
        switchBtn:'עבור לחשבון מוטב',
      },
      // #93 — draft restored
      draftRestored:  'הטיוטה שלך שוחזרה לאחר הפסקת הפגישה',
      draftCleared:   'הטיוטה נמחקה',
      reloginPrompt:  'הפגישה פגה תוקף. אנא התחבר שוב — הטיוטה תישמר.',
      // #94 — success after submit redirect
      newRequestBadge: 'בקשה חדשה',
    },
  },

  // ============================================================
  //  ENGLISH
  // ============================================================
  en: {
    dir: 'ltr',
    lang: 'en',

    nav: {
      home:        'Home',
      requests:    'Submit Request',
      directory:   'Community Directory',
      volunteers:  'Volunteer',
      about:       'About',
      contact:     'Contact',
      faq:         'FAQ',
      track:       'Track Request',
      admin:       'Admin',
      submitBtn:   '+ Submit Request',
      openMenu:    'Open menu',
      closeMenu:   'Close menu',
    },

    hero: {
      badge:          '✦ Registered NGO • Free Consulting • Israel & Ethiopia',
      title1:         'Because everyone',
      titleHighlight: 'deserves',
      title2:         'to fulfill their potential',
      subtitle:       'Push for Fulfillment supports the Ethiopian community in Israel with education, employment, legal aid, and social integration. We are here for you.',
      cta:            'Submit a Request',
      ctaSecondary:   'Our Services',
      stats: {
        beneficiaries: 'People Served',
        volunteers:    'Active Volunteers',
        satisfaction:  'Satisfaction Rate',
        years:         'Years Active',
      },
    },

    services: {
      title:   'Our Areas of Activity',
      subtitle:'We provide professional support in four key areas for community members',
      items: {
        education: {
          title: 'Education & Learning',
          desc:  'Support for matriculation exams, academic scholarships, higher education promotion, and personal mentoring.',
        },
        employment: {
          title: 'Employment & Career',
          desc:  'Professional training, CV writing, interview preparation, and employer connections.',
        },
        legal: {
          title: 'Legal Aid',
          desc:  'Assistance with residency, citizenship, workers\' rights, and government authority matters.',
        },
        social: {
          title: 'Social Integration',
          desc:  'Support groups, community activities, and connections to welfare services and resources.',
        },
      },
    },

    stories: {
      title:   'Success Stories',
      subtitle:'What our beneficiaries say about us',
    },

    cta: {
      title:    'Ready for the Next Step?',
      subtitle: 'Our team is available to help. Submit a request now and we\'ll get back to you within 48 hours.',
      primary:  'Submit a Request Now',
      secondary:'Join as a Volunteer',
    },

    partners: {
      title: 'Partner Organizations',
    },

    request: {
      pageTitle:   'Submit a Support Request',
      pageSubtitle:'Fill out the form and a representative will contact you within 48 hours',
      steps: {
        personal:   'Personal Details',
        type:       'Request Type',
        documents:  'Documents',
        confirm:    'Confirm',
      },
      step1: {
        title:       'Personal Details',
        firstName:   'First Name',
        lastName:    'Last Name',
        idNumber:    'ID Number',
        phone:       'Phone Number',
        email:       'Email Address',
        city:        'City of Residence',
        age:         'Age',
        gender:      'Gender',
        genderM:     'Male',
        genderF:     'Female',
        genderO:     'Other',
        firstNamePH: 'John',
        lastNamePH:  'Doe',
        idPH:        '000000000',
        phonePH:     '050-0000000',
        emailPH:     'example@email.com',
        agePH:       '25',
        required:    '* Required fields',
      },
      step2: {
        title:       'How Can We Help?',
        subtitle:    'Select the support category that best fits your needs',
        description: 'Request Description',
        descPH:      'Describe your need in a few words...',
        urgency:     'Urgency Level',
        urgencyLow:  'Normal — within 2 weeks',
        urgencyMed:  'Medium — within 1 week',
        urgencyHigh: 'Urgent — within 48 hours',
        cats: {
          education: { label: 'Education & Learning', hint: 'Scholarships, exams, higher education' },
          employment:{ label: 'Employment & Career',  hint: 'CV, interviews, training' },
          legal:     { label: 'Legal Aid',            hint: 'Status, citizenship, rights' },
          social:    { label: 'Social Integration',   hint: 'Community, welfare, support' },
        },
      },
      step3: {
        title:         'Upload Documents',
        subtitle:      'Please attach your ID and any relevant supporting documents',
        idLabel:       'ID Document (Required)',
        idHint:        'Drag file here or click to select',
        idFormats:     'JPG, PNG, PDF • Up to 5MB',
        supportLabel:  'Supporting Documents (Optional)',
        supportHint:   'Study certificates, employment contract, legal documents',
        supportFormats:'JPG, PNG, PDF • Up to 10MB per file',
        security:      '🔒 All documents are transferred with full encryption and stored on secure servers only',
        uploaded:      'Uploaded successfully',
        uploading:     'Uploading...',
        remove:        'Remove',
      },
      step4: {
        title:       'Review & Confirm',
        fullName:    'Full Name',
        phone:       'Phone',
        city:        'City',
        category:    'Category',
        description: 'Description',
        urgency:     'Urgency',
        consent:     'I confirm that the information I provided is accurate and I agree to the organization\'s Privacy Policy and Terms of Use.',
      },
      success: {
        title:       'Request Submitted Successfully!',
        subtitle:    'We received your request. A representative will contact you within 48 hours. Save your tracking number:',
        backHome:    'Back to Home',
        trackBtn:    'Track My Request',
      },
      nav: {
        next: 'Continue',
        back: 'Back',
        submit: 'Submit Request',
      },
      validation: {
        required:    'This field is required',
        invalidId:   'ID must contain 9 digits',
        invalidPhone:'Invalid phone number',
        invalidEmail:'Invalid email address',
        selectCity:  'Please select a city',
        selectCat:   'Please select a category',
        needDesc:    'Please describe your request',
        needConsent: 'You must agree to the terms to continue',
        needId:      'Please upload your ID document',
      },
      cities: ['Tel Aviv','Haifa','Jerusalem','Beer Sheva','Netanya','Ashdod','Rishon LeZion','Ramla','Lod','Petah Tikva','Bnei Brak','Herzliya','Kfar Saba','Ra\'anana','Other'],
    },

    directory: {
      pageTitle:   'Community & Business Directory',
      pageSubtitle:'Database of community businesses and partner organizations',
      tabBusiness: 'Community Businesses',
      tabNGO:      'Partner Organizations',
      searchPH:    'Search business, name, service...',
      searchNGO:   'Search organization, area of activity...',
      filterAll:   'All',
      noResults:   'No results found',
      noResultsHint:'Try different search terms',
      registerBiz: 'Register Your Business',
      referBtn:    'Refer Request to Organization',
      moreBtn:     'More Details',
      categories:  { food:'Food', services:'Services', health:'Health', education:'Education', beauty:'Beauty & Wellness', tech:'Technology' },
      ngoAreas:    { all:'All', education:'Education', employment:'Employment', legal:'Legal', social:'Social', housing:'Housing' },
      smartSuggest:'⚡ Your request may also fit these organizations',
    },

    volunteers: {
      pageTitle:    'Volunteers',
      pageSubtitle: 'Join our volunteer team and help the community',
      registerTitle:'Volunteer Registration',
      registerSub:  'Fill out your details and a representative will contact you',
      activeTitle:  'Active Volunteers',
      activeSub:    'Volunteers supporting the community',
      form: {
        fullName:   'Full Name',
        profession: 'Profession / Area of Expertise',
        profPH:     'Lawyer, engineer, teacher...',
        areas:      'Volunteering Areas',
        availability:'Weekly Availability',
        avail1:     '2-4 hours per week',
        avail2:     '4-8 hours per week',
        avail3:     '8+ hours per week',
        submitBtn:  'Submit Volunteer Registration',
        areasList:  ['Education & Mentoring','Legal Consulting','Employment','Social Integration','Health & Welfare','Entrepreneurship & Business'],
      },
      available: 'Available for Assignment',
    },

    admin: {
      title:      'Admin Dashboard',
      dashboard:  'Overview',
      requests:   'Requests',
      users:      'Users',
      volunteers: 'Volunteers',
      businesses: 'Businesses',
      analytics:  'Analytics',
      lastUpdate: 'Last updated',
      today:      'Today',
      stats: {
        openRequests:  'Open Requests',
        totalHelped:   'Total Served',
        activeVol:     'Active Volunteers',
        satisfaction:  'Satisfaction Rate',
        thisMonth:     'this month',
        thisYear:      'this year',
      },
      table: {
        requestId:   'Request #',
        name:        'Applicant Name',
        category:    'Category',
        city:        'City',
        status:      'Status',
        date:        'Date',
        actions:     'Actions',
        email:       'Email',
        requests:    'Requests',
        joined:      'Joined',
        skills:      'Skills',
        assignment:  'Current Assignment',
        available:   'Availability',
        approve:     'Approve',
        reject:      'Reject',
        edit:        'Edit',
        delete:      'Delete',
        assign:      'Assign',
        view:        'View',
        addRequest:  '+ New Request',
        addUser:     '+ Add User',
        export:      'Export CSV',
      },
      charts: {
        byCategory:  'Requests by Category (This Month)',
        byCity:      'Requests by City',
        trend:       'Request Trend — Last 6 Months',
      },
    },

    track: {
      pageTitle:   'Track Your Request',
      pageSubtitle:'Enter your tracking number to check the current status',
      placeholder: 'PFF-2024-XXXXX',
      searchBtn:   'Check Status',
      notFound:    'No request found with this number',
      notFoundHint:'Please check the number you entered and try again',
      timeline: {
        submitted:  'Request Submitted',
        reviewing:  'Under Review',
        approved:   'Request Approved',
        inProgress: 'Active Processing',
        completed:  'Processing Completed',
      },
      info: {
        number:   'Request Number',
        category: 'Category',
        submitted:'Submission Date',
        status:   'Current Status',
        handler:  'Handler',
        notes:    'Notes',
      },
    },

    about: {
      pageTitle:  'About the Organization',
      mission:    'Our Mission',
      missionText:'Push for Fulfillment was established to support and advance members of the Ethiopian community in Israel. We believe every person deserves the opportunity to fulfill their full potential, and we are here to make that a reality.',
      values:     'Our Values',
      team:       'Our Team',
      history:    'Our History',
    },

    contact: {
      pageTitle:   'Contact Us',
      pageSubtitle:'We are here for any question, suggestion, or information request',
      form: {
        name:     'Full Name',
        email:    'Email Address',
        subject:  'Subject',
        message:  'Message',
        messagePH:'Write your message here...',
        send:     'Send Message',
        success:  'Your message was sent successfully! We\'ll get back to you soon.',
      },
      info: {
        phone:   'Phone',
        email:   'Email',
        address: 'Address',
        hours:   'Office Hours',
        hoursVal:'Sun–Thu 9:00–18:00',
      },
    },

    faq: {
      pageTitle:   'Frequently Asked Questions',
      pageSubtitle:'Answers to the most common questions',
      searchPH:    'Search question...',
    },

    status: {
      pending:    'Pending',
      review:     'Under Review',
      approved:   'Approved',
      rejected:   'Rejected',
      inProgress: 'In Progress',
      completed:  'Completed',
    },

    common: {
      loading:    'Loading...',
      save:       'Save',
      cancel:     'Cancel',
      close:      'Close',
      back:       'Back',
      next:       'Next',
      yes:        'Yes',
      no:         'No',
      search:     'Search',
      filter:     'Filter',
      all:        'All',
      new:        'New',
      required:   'Required',
      optional:   'Optional',
      noData:     'No data to display',
      error:      'Error',
      success:    'Success',
      copy:       'Copy',
      copied:     'Copied!',
      print:      'Print',
      export:     'Export',
      moreInfo:   'More Info',
      less:       'Less',
      page:       'Page',
      of:         'of',
      results:    'results',
      confirm:    'Confirm',
      delete:     'Delete',
      deleteConfirm: 'Are you sure you want to delete this?',
      or:         'or',
    },

    footer: {
      tagline:    'Promoting self-fulfillment for the Ethiopian community in Israel',
      quickLinks: 'Quick Links',
      services:   'Services',
      contact:    'Contact',
      legal:      'Legal',
      privacy:    'Privacy Policy',
      terms:      'Terms of Use',
      accessibility: 'Accessibility Statement',
      rights:     'All rights reserved – Push for Fulfillment NGO',
      reg:        'Registered NGO in Israel • Reg. No. 58-1234567',
    },

    notFound: {
      title:   'Page Not Found',
      subtitle:'The page you\'re looking for doesn\'t exist or has been moved.',
      btn:     'Back to Home',
    },

    // ── AUTH (CC-5) ───────────────────────────────────────────
    auth: {
      login: {
        title:        'Sign In',
        subtitle:     'Sign in to submit a request or track existing ones.',
        email:        'Email',
        password:     'Password',
        submit:       'Sign In',
        submitting:   'Signing in...',
        noAccount:    "Don't have an account?",
        registerLink: 'Register here',
        error:        'Sign-in failed. Check your email and password.',
      },
      register: {
        title:           'Register',
        subtitle:        'Create a new account to submit and track requests.',
        email:           'Email',
        password:        'Password',
        confirmPassword: 'Confirm Password',
        submit:          'Register',
        submitting:      'Creating account...',
        haveAccount:     'Already have an account?',
        loginLink:       'Sign in here',
        passwordMismatch:"Passwords don't match",
        passwordTooShort:'Password must be at least 6 characters',
        error:           'Registration failed. Please try again.',
        emailInUse:      'This email is already registered.',
      },
      logout:           'Sign Out',
      welcome:          'Hello',
    },

    // === Stream 3 (volunteer signup) ===
    volunteerSignup: {
      // Tab toggle on register page
      tabBeneficiary: 'Beneficiary',
      tabVolunteer:   'Volunteer',

      // Step 1 — account creation labels (reuses auth.register for email/pw)
      step1Title:     'Account Details',

      // Step 2 — volunteer details form
      step2Title:     'Volunteer Details',
      firstName:      'First Name',
      lastName:       'Last Name',
      phone:          'Phone Number',
      email:          'Email Address',
      city:           'City',
      profession:     'Profession / Area of Expertise',
      professionPH:   'Lawyer, engineer, teacher...',
      areasOfHelp:    'Areas of Help',
      languages:      'Languages',
      languagesPH:    'Hebrew, Amharic, English...',
      availability:   'Weekly Availability',
      avail24:        '2–4 hours per week',
      avail48:        '4–8 hours per week',
      avail8plus:     '8+ hours per week',
      motivation:     'Motivation / Additional Notes',
      motivationPH:   'Tell us a bit about yourself...',
      consent:        'I agree to the Terms of Use and Privacy Policy, and consent to my details being stored for volunteer coordination purposes.',
      areasList:      ['Education & Mentoring', 'Legal Consulting', 'Employment', 'Social Integration', 'Health & Welfare', 'Entrepreneurship & Business'],

      // Navigation
      nextStep:       'Continue to Volunteer Details',
      backStep:       'Back to Account Details',
      submit:         'Submit Volunteer Application',
      submitting:     'Submitting...',

      // Errors
      minOneArea:     'Please select at least one area of help',
      minOneLang:     'Please enter at least one language',
      consentRequired:'You must agree to the terms to continue',

      // Thanks page
      thanksTitle:    'Thank You for Applying!',
      thanksSubtitle: 'We received your volunteer application. A representative will contact you soon to coordinate.',
      thanksBackHome: 'Back to Home',
    },

    // ── MY REQUESTS (UC-01-e) ─────────────────────────────────
    myRequests: {
      navLink:  'My Requests',
      title:    'My Requests',
      subtitle: 'Track the requests you have submitted',
      empty:    "You haven't submitted any requests yet.",
      submitCta:'Submit a new request',
      loading:  'Loading your requests...',
      table: {
        id:          'Request ID',
        category:    'Category',
        urgency:     'Urgency',
        status:      'Status',
        date:        'Date submitted',
        attachments: 'Files',
        deadline:    'Deadline',
      },
      categories: {
        education:  'Education',
        employment: 'Employment',
        legal:      'Legal',
        social:     'Social',
      },
      urgencies: {
        low:    'Low',
        medium: 'Medium',
        high:   'High',
      },
      statuses: {
        pending:      'Pending',
        inReview:     'In review',
        assigned:     'Assigned',
        inProgress:   'In progress',
        resolved:     'Resolved',
        rejected:     'Rejected',
        needsChanges: 'Needs changes',
      },
      // #68 — timeline
      timeline: {
        title:            'Request Timeline',
        noEvents:         'No events yet',
        types: {
          created:          'Request created',
          attachment_added: 'Document attached',
          assigned:         'Handler assigned',
          status_changed:   'Status updated',
          note_added:       'Note added',
          rated:            'Rating added',
        },
      },
      // #68 — deadline pill
      dueIn: (days) => days === 0 ? 'Due today' : days < 0 ? `Overdue by ${Math.abs(days)} days` : `Due in ${days} days`,
      overdue: 'Overdue',
    },

    // === Stream 2 (UC-01 form) ===
    // Keys added by Stream 2 agent. Do not reorder or reformat existing keys.
    stream2: {
      // #66 — ID-type selector
      idType: {
        label:      'ID Type',
        israeliId:  'Israeli ID',
        passport:   'Passport / Foreign Document',
        none:       'No ID Document',
        noteLabel:  'Explanation (optional)',
        notePH:     'Explain why you do not have an ID...',
      },
      // #67 — auto-fill
      autoFill: {
        fillBtn:       'Auto-fill from my profile',
        saveToProfile: 'Save details to profile',
        saved:         'Details saved to profile',
        saveError:     'Failed to save profile',
        emailNote:     'You may change your email address',
      },
      // #68 — deadline picker
      deadline: {
        label: 'Desired completion deadline (optional)',
        hint:  'Leave empty if no specific date is required',
      },
      // #90 — admin notice
      adminNotice: {
        title:    'Admin account signed in',
        body:     'You cannot submit a request from an admin account. Please switch to a beneficiary account.',
        switchBtn:'Switch account',
      },
      // #93 — draft restored
      draftRestored: 'Your draft was restored after your session expired',
      draftCleared:  'Draft cleared',
      reloginPrompt: 'Your session expired. Please sign in again — your draft is saved.',
      // #94 — success after submit redirect
      newRequestBadge: 'New request',
    },
  },
}

export default translations
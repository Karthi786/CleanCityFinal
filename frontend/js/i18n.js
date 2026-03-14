// js/i18n.js
// Centralized translation dictionary and logic for CleanMadurai

const translations = {
    en: {
        // General & Nav
        'nav_home': 'Home',
        'nav_dashboard': 'Dashboard',
        'nav_reports': 'Reports',
        'nav_departments': 'Departments',
        'nav_settings': 'Settings',
        'nav_notifications': 'Notifications',
        'nav_login': 'Login',
        'nav_logout': 'Sign Out',
        'app_title': 'CleanMadurai',

        // Auth & Homepage
        'hero_title_1': 'Smart & Clean',
        'hero_title_2': 'Madurai',
        'hero_subtitle': 'Report. Support. Transform.',
        'auth_login_title': 'Login to your account',
        'auth_register_title': 'Create an Account',
        'lbl_email': 'Email Address',
        'lbl_pwd': 'Password',
        'btn_signin': 'Sign In',
        'btn_register': 'Register',
        'lbl_remember': 'Remember me',
        'lbl_forgot_pwd': 'Forgot password?',
        'lbl_fullname': 'Full Name',
        'lbl_phone': 'Phone Number',
        'lbl_confirm_pwd': 'Confirm Password',
        'lbl_no_account': 'Don\'t have an account? Sign up',
        'lbl_has_account': 'Already have an account? Sign in',

        // Buttons
        'btn_submit': 'Submit',
        'btn_cancel': 'Cancel',
        'btn_update': 'Update',
        'btn_delete': 'Delete',
        'btn_search': 'Search',
        'btn_filter': 'Filter',
        'btn_download': 'Download Excel',
        'btn_view_details': 'View Details',
        'btn_choose_file': 'Choose File',

        // Roles, Categories & Departments
        'role_cit': 'Citizen',
        'role_dept': 'Department',
        'role_col': 'District Collector',
        'dept_all': 'All Departments',
        'cat_waste': 'Waste Management',
        'cat_water': 'Water Supply',
        'cat_eb': 'Electricity Board',
        'cat_pw': 'Public Works',
        'cat_police': 'Police',
        'cat_fire': 'Fire Station',

        // Dashboards
        'col_panel': 'Collector Panel',
        'dept_panel': 'Department Panel',
        'cit_panel': 'Citizen Panel',
        'tab_issues': 'Issues',
        'tab_analytics': 'Analytics',
        'tab_map': 'Heatmap',
        'tab_reviews': 'Reviews',
        'tab_all_reviews': 'All Reviews',

        'lbl_total_reports': 'Total Reports',
        'lbl_pending_reports': 'Pending Reports',
        'lbl_completed_reports': 'Completed Reports',
        'lbl_in_progress': 'In Progress',

        'lbl_dept_overview': 'Department Overview',
        'lbl_dist_overview': 'District Overview',

        'status_pending': 'Pending',
        'status_in_progress': 'In Progress',
        'status_completed': 'Done',
        'status_approved': 'Approved',
        'status_rejected': 'Rejected',

        // Dashboard Analytics
        'lbl_city_wide_mgt': 'City-Wide Management',
        'lbl_city_wide_desc': 'Monitor and oversee civic issue resolution across all departments.',
        'lbl_issue_density': 'Issue Density Matrix',
        'lbl_issue_density_desc': 'Geographical visualization of civic issues across Madurai to identify hotspots.',
        'lbl_assigned_issues': 'Assigned Issues',
        'lbl_resolved_cases': 'Resolved Cases',
        'lbl_total_complaints': 'Total Complaints',
        'lbl_resolution_rate': 'Resolution Rate',
        'lbl_status_dist': 'Status Distribution',
        'lbl_monthly_trend': 'Monthly Complaint Trend',
        'lbl_dept_perf': 'Department Performance',
        'lbl_monthly_sub': 'Total vs. Resolved complaints per month (last 6 months)',
        'lbl_status_sub': 'Pending · In Progress · Resolved',

        // Action Menus & Modals
        'modal_update_title': 'Update Issue Status',
        'modal_citizen_img': 'Citizen Uploaded Image',
        'modal_status_mgt': 'Status Management',
        'modal_upload_proof': 'Upload Resolution Proof',
        'modal_upload_desc': 'Please upload an image showing the completed work',
        'lbl_no_file': 'No file chosen',

        // Forms & Tables
        'lbl_report_name': 'Report Name',
        'lbl_report_desc': 'Description',
        'lbl_department': 'Department',
        'lbl_location': 'Location',
        'lbl_status': 'Status',
        'lbl_date': 'Date',

        'th_id': 'Report ID',
        'th_name': 'Report Name',
        'th_desc': 'Description',
        'th_dept': 'Department',
        'th_created': 'Created Date',
        'th_pending': 'Pending Date',
        'th_completed': 'Completed Date',
        'th_status': 'Status',
        'th_last_updated': 'Last Updated',
        'th_assigned_dept': 'Assigned Department'
    },
    ta: {
        // General & Nav
        'nav_home': 'முகப்பு',
        'nav_dashboard': 'கட்டுப்பாட்டு அறை',
        'nav_reports': 'புகார்கள்',
        'nav_departments': 'துறைகள்',
        'nav_settings': 'அமைப்புகள்',
        'nav_notifications': 'அறிவிப்புகள்',
        'nav_login': 'உள்நுழைக',
        'nav_logout': 'வெளியேறு',
        'app_title': 'க்ளீன் மதுரை',

        // Auth & Homepage
        'hero_title_1': 'ஸ்மார்ட் மற்றும் சுத்தமான',
        'hero_title_2': 'மதுரை',
        'hero_subtitle': 'புகாரளிக்கவும் • ஆதரிக்கவும் • மாற்றத்தை உருவாக்கவும்',
        'auth_login_title': 'உங்கள் கணக்கில் உள்நுழைக',
        'auth_register_title': 'புதிய கணக்கு உருவாக்கவும்',
        'lbl_email': 'மின்னஞ்சல் முகவரி',
        'lbl_pwd': 'கடவுச்சொல்',
        'btn_signin': 'உள்நுழை',
        'btn_register': 'பதிவு செய்யவும்',
        'lbl_remember': 'என்னை நினைவில் கொள்ளவும்',
        'lbl_forgot_pwd': 'கடவுச்சொல் மறந்துவிட்டதா?',
        'lbl_fullname': 'முழுப் பெயர்',
        'lbl_phone': 'தொலைபேசி எண்',
        'lbl_confirm_pwd': 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
        'lbl_no_account': 'கணக்கு இல்லையா? பதிவு செய்யவும்',
        'lbl_has_account': 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக',

        // Buttons
        'btn_submit': 'சமர்ப்பி',
        'btn_cancel': 'ரத்து செய்',
        'btn_update': 'புதுப்பி',
        'btn_delete': 'அழி',
        'btn_search': 'தேடு',
        'btn_filter': 'வடிகட்டு',
        'btn_download': 'எக்செல் பதிவிறக்கு',
        'btn_view_details': 'விவரங்களை காண்',
        'btn_choose_file': 'கோப்பை தேர்வு செய்யவும்',

        // Roles, Categories & Departments
        'role_cit': 'குடிமகன்',
        'role_dept': 'துறை',
        'role_col': 'மாவட்ட ஆட்சியர்',
        'dept_all': 'அனைத்து துறைகள்',
        'cat_waste': 'குப்பை மேலாண்மை',
        'cat_water': 'குடிநீர் வழங்கல்',
        'cat_eb': 'மின்சார வாரியம்',
        'cat_pw': 'பொது பணித் துறை',
        'cat_police': 'காவல் துறை',
        'cat_fire': 'தீயணைப்பு நிலையம்',

        // Dashboards
        'col_panel': 'ஆட்சியர் தளம்',
        'dept_panel': 'துறை தளம்',
        'cit_panel': 'குடிமக்கள் தளம்',
        'tab_issues': 'சிக்கல்கள்',
        'tab_analytics': 'பகுப்பாய்வு',
        'tab_map': 'வரைபடம்',
        'tab_reviews': 'மதிப்புரைகள்',
        'tab_all_reviews': 'அனைத்து மதிப்புரைகள்',

        'lbl_total_reports': 'மொத்த புகார்கள்',
        'lbl_pending_reports': 'நிலுவையில் உள்ளவை',
        'lbl_completed_reports': 'முடிக்கப்பட்டவை',
        'lbl_in_progress': 'செயல்பாட்டில்',

        'lbl_dept_overview': 'துறை கண்ணோட்டம்',
        'lbl_dist_overview': 'மாவட்ட கண்ணோட்டம்',

        'status_pending': 'நிலுவையில்',
        'status_in_progress': 'செயல்பாட்டில்',
        'status_completed': 'முடிந்தது',
        'status_approved': 'அனுமதிக்கப்பட்டது',
        'status_rejected': 'நிராகரிக்கப்பட்டது',

        // Dashboard Analytics
        'lbl_city_wide_mgt': 'நகரமுழுவதும் நிர்வாகம்',
        'lbl_city_wide_desc': 'அனைத்து துறைகளிலும் குடிமக்கள் புகார்களின் தீர்வை கண்காணிக்கவும்',
        'lbl_issue_density': 'பிரச்சனை அடர்த்தி வரைபடம்',
        'lbl_issue_density_desc': 'மதுரையில் அதிகமாக ஏற்படும் பிரச்சனை பகுதிகளை கண்டறிய நிலவர வரைபடம்',
        'lbl_assigned_issues': 'ஒதுக்கப்பட்ட புகார்கள்',
        'lbl_resolved_cases': 'தீர்க்கப்பட்ட வழக்குகள்',
        'lbl_total_complaints': 'மொத்த புகார்கள்',
        'lbl_resolution_rate': 'தீர்வு விகிதம்',
        'lbl_status_dist': 'நிலை விநியோகம்',
        'lbl_monthly_trend': 'மாதாந்திர புகார் நிலை',
        'lbl_dept_perf': 'துறை செயல்திறன்',
        'lbl_monthly_sub': 'மாதந்தோறும் மொத்தம் மற்றும் தீர்க்கப்பட்ட புகார்கள் (கடைசி 6 மாதங்கள்)',
        'lbl_status_sub': 'நிலுவையில் · செயல்பாட்டில் · தீர்க்கப்பட்டது',

        // Action Menus & Modals
        'modal_update_title': 'புகார் நிலையை புதுப்பிக்கவும்',
        'modal_citizen_img': 'குடிமகன் பதிவேற்றிய படம்',
        'modal_status_mgt': 'நிலை நிர்வாகம்',
        'modal_upload_proof': 'தீர்வு ஆதாரத்தை பதிவேற்றவும்',
        'modal_upload_desc': 'செய்யப்பட்ட பணியின் படத்தை பதிவேற்றவும்',
        'lbl_no_file': 'எந்த கோப்பும் தேர்வு செய்யப்படவில்லை',

        // Forms & Tables
        'lbl_report_name': 'புகார்',
        'lbl_report_desc': 'விளக்கம்',
        'lbl_department': 'துறை',
        'lbl_location': 'இடம்',
        'lbl_status': 'நிலை',
        'lbl_date': 'தேதி',

        'th_id': 'புகார் எண்',
        'th_name': 'புகார்',
        'th_desc': 'விளக்கம்',
        'th_dept': 'துறை',
        'th_created': 'உருவாக்கப்பட்ட தேதி',
        'th_pending': 'நிலுவை தேதி',
        'th_completed': 'முடிக்கப்பட்ட தேதி',
        'th_status': 'நிலை',
        'th_last_updated': 'கடைசியாக புதுப்பிக்கப்பட்டது',
        'th_assigned_dept': 'ஒதுக்கப்பட்ட துறை'
    }
};

// State
let currentLang = localStorage.getItem('cm_lang') || 'en';

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('cm_lang', lang);
        applyTranslations();
        // Fire custom event so JS that generates charts/tables can refresh
        window.dispatchEvent(new Event('languageChanged'));
    }
}

export function t(key) {
    return translations[currentLang][key] || translations['en'][key] || key;
}

export function applyTranslations() {
    // 1. Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        // Handle input placeholders vs regular text
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const translated = t(key);
            if (el.placeholder) el.placeholder = translated;
            if (el.title) el.title = translated;
        } else {
            // Check if element has child elements (like icons) that we shouldn't overwrite completely
            // Instead, find the text node or a specific span.
            // Simplified handling: if it contains an icon, better to use a target span.
            const targetSpan = el.querySelector('.i18n-text');
            if (targetSpan) {
                targetSpan.textContent = t(key);
            } else {
                el.textContent = t(key);
            }
        }
    });

    // 2. Select the correct option in language dropdowns
    document.querySelectorAll('.lang-switcher').forEach(select => {
        select.value = currentLang;
    });

    // 3. Update HTML lang tag
    document.documentElement.lang = currentLang;
}

// Initialize translations on DOM load
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();

    // Wire up any switcher selects automatically
    document.querySelectorAll('.lang-switcher').forEach(select => {
        // Remove old listeners to prevent duplicates if re-injected
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        newSelect.value = currentLang;
        newSelect.addEventListener('change', (e) => {
            setLang(e.target.value);
        });
    });
});

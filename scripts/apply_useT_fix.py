"""
Apply useT mocks to 10 failing test files.
Each mock has a resolveT function with CORRECT plural handling
(checks _plural FIRST when count !== 1, then falls back to singular).
"""
import json
import os
import sys

# ── Translation data (from en.ts) ──

ipos = {
    'dashboard': 'IPO Dashboard', 'subtitleSummary': '{{open}} open · {{upcoming}} upcoming · {{listed}} listed',
    'activeIPOs': 'Active IPOs', 'myApps': 'My Apps ({{count}})',
    'showingCount': '{{count}} IPO', 'showingCount_plural': '{{count}} IPOs',
    'applyViaUPI': 'Apply via UPI', 'noIPOs': 'No IPOs found', 'noIPOsSub': 'Check back later for new IPOs',
    'priceBand': 'Price Band', 'lot': 'Lot', 'shares': 'shares', 'minInvest': 'Min Investment',
    'gmp': 'GMP', 'expectedListing': 'Exp. Listing',
    'subscriptionLabel': '{{value}}x', 'subQIB': 'QIB', 'subHNI': 'HNI', 'subRetail': 'Ret',
    'openLabel': 'Open: {{date}}', 'listingLabel': 'Listing: {{date}}',
    'statusOpen': 'Open Now', 'statusListed': 'Listed', 'statusUpcoming': 'Upcoming',
    'lots': 'Lots', 'sharesLabel': 'Shares', 'price': 'Price', 'amount': 'Amount',
    'allottedLabel': 'Allotted', 'listingPriceLabel': 'Listing Price', 'gain': 'Gain',
    'upiLabel': 'UPI: {{id}}', 'appliedLabel': 'Applied: {{date}}',
    'applyTitle': 'Apply via UPI', 'numberOfLots': 'Number of Lots', 'custom': 'Custom',
    'lotsSuffix': 'lots', 'bidPriceLabel': 'Bid Price (\u20b9)', 'cutOff': 'Cut-off', 'higher': 'Higher',
    'upiIdLabel': 'UPI ID', 'upiPlaceholder': 'e.g., name@hdfc',
    'pricePerShare': 'Price per share', 'totalAmount': 'Total Amount',
    'submitting': 'Submitting...', 'applyFor': 'Apply for {{amount}}',
    'upiInfo': 'Amount will be blocked in UPI until allotment',
    'invalidUpiTitle': 'Invalid UPI ID', 'invalidUpiMsg': 'Please enter a valid UPI ID.',
    'invalidLotsTitle': 'Invalid Lots', 'invalidLotsMsg': 'Please select a valid number of lots.',
    'appSubmittedTitle': 'Application Submitted \u2705', 'submitError': 'Failed to submit application',
    'filterAll': 'All', 'filterOpen': 'Open', 'filterUpcoming': 'Upcoming', 'filterClosed': 'Closed',
    'filterListed': 'Listed', 'filterActive': 'Active', 'total': 'Total',
    'appSubmitted': 'Submitted', 'appAllotted': 'Allotted', 'appNotAllotted': 'Not Allotted',
    'invested': 'Invested', 'profit': 'Profit', 'noApplications': 'No Applications',
    'noAppsSub': 'Apply to an open IPO to see it here',
    'appCount': '{{count}}', 'appCount_plural': '{{count}}',
    'appsTracked': '{{count}} applications tracked',
}

profile = {
    'profileKyc': 'Profile & KYC', 'availableBalance': 'Available Balance', 'lifetimeXp': 'Lifetime XP',
    'accountType': 'Account Type', 'tradingAccount': 'Trading Account', 'dpId': 'DP ID',
    'broker': 'Broker', 'accountOpened': 'Account Opened', 'panLabel': 'PAN',
    'emailLabel': 'Email', 'phoneLabel': 'Phone',
    'personalInformation': 'Personal Information', 'editProfile': 'Edit Profile',
    'changePassword': 'Change Password', 'notificationPreferences': 'Notification Preferences',
    'kycStatus': 'KYC Status', 'kycVerified': 'KYC Verified', 'kycAndBanks': 'KYC & Banks',
    'accountDetails': 'Account Details', 'accountDetailsSub': 'Your trading account information',
    'kycHelperText': 'Tap on a step to start verification.',
    'linkedBanks': 'Linked Bank Accounts', 'banksLinked': '{{count}} account(s) linked',
    'primary': 'Primary', 'ifsc': 'IFSC', 'addBankAccount': 'Add Bank Account',
    'sectionInvestments': 'Investments', 'sectionLearnAndGrow': 'Learn & Grow', 'sectionAccount': 'Account',
    'referral': 'Refer & Earn', 'homeWidget': 'Home Widget', 'upiSettings': 'UPI Settings',
    'logout': 'Log Out', 'help': 'Help & Support', 'securitySettings': 'Security Settings',
    'replayTour': 'Replay Tour', 'replayTourConfirm': 'This will restart the onboarding walkthrough.',
    'startTour': 'Start Tour', 'goPremium': 'Go Premium', 'paymentHistory': 'Payment History',
    'portfolioAlerts': 'Portfolio Alerts', 'riskSettings': 'Risk Settings', 'connectBroker': 'Connect Broker',
    'fnoTrading': 'F&O Trading', 'opStrategies': 'Op. Strategies', 'tradeHistory': 'Trade History',
    'openOrders': 'Open Orders', 'title': 'Profile', 'reports': 'Reports', 'messages': 'Messages',
    'panVerification': 'PAN Verification', 'aadhaarVerification': 'Aadhaar Verification',
    'digilocker': 'DigiLocker', 'bankLinking': 'Bank Linking', 'account': 'Account', 'more': 'More',
}

trading = {
    'buySecurities': 'Buy Securities', 'sellSecurities': 'Sell Securities',
    'productType': 'Product Type', 'marketDesc': 'Buy/Sell at current market price',
    'limitDesc': 'Execute only at your specified price or better',
    'stopLossDesc': 'Convert to market order when trigger price is hit',
    'stopLossMarketDesc': 'Market order that activates at trigger price',
    'cncDesc': 'Delivery - settle with actual shares', 'misDesc': 'Intraday - square off by EOD',
    'nrmlDesc': 'Normal - for futures & options', 'owned': '(Owned: {{count}})',
    'max': 'Max', 'limitPrice': 'Limit Price (\u20b9)', 'triggerPrice': 'Trigger Price (\u20b9)',
    'enterTriggerPrice': 'Enter trigger price', 'pricePerShare': 'Price per share', 'shares': 'shares',
    'estimatedTotal': 'Estimated Total', 'grandTotal': 'Grand Total',
    'balanceAvailable': 'Available: {{amount}}', 'availableBalance': 'Available Balance',
    'goBack': 'Go Back', 'processing': 'Processing...', 'orderPlacedSuccessfully': 'Order Placed Successfully!',
    'bought': 'Bought', 'sold': 'Sold', 'of': 'of', 'price': 'Price', 'time': 'Time', 'done': 'Done',
    'orderFailed': 'Order Failed', 'quantityLabel': 'Quantity', 'orderTypeLabel': 'Order Type',
}

education = {
    'myCourses': 'My Courses', 'createManageSubtitle': 'Create and manage your own courses',
    'total': 'Total', 'published': 'Published', 'drafts': 'Drafts', 'students': 'Students',
    'createNewCourse': 'Create New Course', 'noCoursesYet': 'No courses yet',
    'noCoursesSubtitle': 'Tap to start building your first course!',
    'submitForReview': 'Submit for Review', 'cannotSubmit': 'Cannot Submit',
    'cannotSubmitMsg': 'Please add a title and at least one lesson.',
    'archiveCourse': 'Archive Course', 'restoreCourse': 'Restore Course', 'duplicate': 'Duplicate',
    'deleteCourse': 'Delete Course', 'deleteCourseConfirm': 'Are you sure you want to delete "{{title}}"?',
    'untitledCourse': 'Untitled Course', 'noDescription': 'No description yet', 'pending': 'Pending',
    'reviewStatus': 'Review Status', 'pendingReview': '\U0001f7e1 Pending Review',
    'approved': 'Approved', 'rejected': 'Rejected', 'needsChanges': '\u274c Rejected - Needs Changes',
    'submitted': 'Submitted', 'courseOptions': 'Course Options',
    'communityCourses': 'Community Courses', 'communitySubtitle': 'Discover courses created by fellow traders',
    'searchCoursesCreators': 'Search courses, creators, or topics...',
    'featuredCourses': 'Featured Courses', 'title': 'Courses',
    'allCommunityCourses': 'All Community Courses', 'filteredResults': 'Filtered ({{count}})',
    'noCoursesFound': 'No courses found', 'noCoursesMatch': 'No courses match query.',
    'noCommunityCourses': 'No published community courses yet. Check back later!',
    'enroll': 'Enroll', 'byCreator': 'by {{name}}', 'enrolled': 'Enrolled',
    'lessonsCount': '{{count}} lessons', 'courseNotFound': 'Course not found',
    'courseProgress': 'Course Progress', 'completed': 'Completed', 'remainingCount': 'Remaining',
    'aboutThisCourse': 'About this Course', 'duration': 'Duration',
    'lessonsProgress': 'Lessons ({{completed}}/{{total}})', 'lessonDone': 'Done',
    'lessonQuiz': 'Quiz', 'nextLesson': 'Next Lesson', 'startCourse': 'Start Course',
    'continueLearning': 'Continue', 'viewCertificate': 'View Certificate',
    'getCertificate': '\U0001f393 Get Certificate', 'rating': 'rating',
    'learningPaths': 'Learning Paths', 'learningPathsSubtitle': 'Curated sequences to master the markets',
    'paths': 'Paths', 'learners': 'Learners', 'lessonsLabel': 'Lessons',
    'coursesProgress': '{{completed}}/{{total}} courses \u00b7 {{percent}}% complete',
    'continuePath': 'Continue Path \u2192', 'startPath': 'Start Path \u2192',
    'sortCategory': 'Category', 'allLevels': 'All Levels', 'beginner': 'Beginner',
    'intermediate': 'Intermediate', 'advanced': 'Advanced',
}

time_ns = {'justNow': 'just now', 'minutesAgo': '{{count}}m ago', 'hoursAgo': '{{count}}h ago', 'daysAgo': '{{count}}d ago'}
errors_ns = {'unknown': 'An unexpected error occurred'}

reports = {
    'title': 'Reports', 'subtitle': 'Download and manage your reports',
    'contractNotes': 'Contract Notes', 'download': 'Download', 'upload': 'Upload',
    'uploadContractNote': 'Upload Contract Note', 'selectFile': 'Select File',
    'noReports': 'No reports yet', 'noReportsSub': 'Upload a contract note to get started',
    'processing': 'Processing...', 'processed': 'Processed', 'failed': 'Failed',
    'delete': 'Delete', 'deleteConfirm': 'Are you sure you want to delete this report?',
    'reportType': 'Report Type', 'dateRange': 'Date Range',
    'apply': 'Apply', 'clear': 'Clear', 'filter': 'Filter',
    'downloadPdf': 'Download PDF', 'share': 'Share', 'print': 'Print',
    'taxReport': 'Tax Report', 'pAndL': 'P&L Statement',
    'tradeConfirmation': 'Trade Confirmation', 'holdingStatement': 'Holding Statement',
}

# ── File config ──

FILE_CONFIGS = [
    ('IPODashboardScreen.test.tsx', 'ipos', ipos, {'errors': errors_ns}),
    ('ProfileScreen.test.tsx', 'profile', profile, None),
    ('PlaceOrderScreen.test.tsx', 'trading', trading, None),
    ('PlaceOrderScreenFrozenFix.test.tsx', 'trading', trading, None),
    ('CommunityCoursesScreen.test.tsx', 'education', education, {'time': time_ns}),
    ('MyCoursesScreen.test.tsx', 'education', education, None),
    ('CourseDetailScreen.test.tsx', 'education', education, None),
    ('LearningPathsScreen.test.tsx', 'education', education, None),
    ('ContractNoteUploadScreen.test.tsx', 'reports', reports, None),
    ('ReportsScreen.test.tsx', 'reports', reports, None),
]

# ── Build mock ──

def make_resolve_t(ns_var, extras):
    """Generate resolveT TypeScript function with correct plural handling."""
    spread = ns_var
    if extras:
        spread += ', ' + ', '.join(f'...{k}' for k in extras.keys())
    
    return f'''
function resolveT(key: string, params?: Record<string, any>): string {{
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = {{ {spread} }};
  const obj = translations[rootNs];
  if (!obj) return key;
  
  // Plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {{
    const pk = subKey + '_plural';
    if (pk in obj && typeof obj[pk] === 'string') {{
      let r: string = obj[pk];
      r = r.replace(/{{{\\w+}}}/g, (m: string) => {{\n        const p = m.slice(2, -2);\n        return params[p] !== undefined ? String(params[p]) : m;\n      }});\n      return r;\n    }}
  }}
  
  // Singular fallback
  if (subKey in obj && typeof obj[subKey] === 'string') {{
    let r: string = obj[subKey];
    if (params) {{
      r = r.replace(/{{{\\w+}}}/g, (m: string) => {{\n        const p = m.slice(2, -2);\n        return params[p] !== undefined ? String(params[p]) : m;\n      }});\n    }}
    return r;\n  }}
  
  return key;\n}}'''


def make_mock_block(ns_var, data, extras):
    """Build the complete mock block as a string."""
    ns_json = json.dumps(data, ensure_ascii=False, indent=2)
    
    extra_decls = ''
    if extras:
        for k, v in extras.items():
            v_json = json.dumps(v, ensure_ascii=False, indent=2)
            extra_decls += f'\nconst {k} = {v_json};'
    
    resolve_t = make_resolve_t(ns_var, extras)
    
    return f'''
// ==================== Mock useT hook ====================
const {ns_var} = {ns_json};{extra_decls}

{resolve_t}

vi.mock('../hooks/useT', () => ({{
  useT: () => ({{
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }}),
  default: () => ({{
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }}),
}}));
'''


def patch_file(filepath, ns_var, data, extras):
    """Add useT mock to test file (after last vi.mock, before imports)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    mock_block = make_mock_block(ns_var, data, extras)
    
    # Find first import statement
    lines = content.split('\n')
    insert_idx = -1
    for i, line in enumerate(lines):
        # Find the first line that starts with "import" (not inside a comment)
        s = line.strip()
        if s.startswith('import ') and not s.startswith('//') and not s.startswith('/*'):
            insert_idx = i
            break
    
    if insert_idx < 0:
        print(f'  ERROR: Cannot find import in {filepath}')
        return False
    
    lines.insert(insert_idx, mock_block)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f'  PATCHED: {filepath}')
    return True


def main():
    test_dir = 'src/__tests__'
    count = 0
    for filename, ns_var, data, extras in FILE_CONFIGS:
        fp = os.path.join(test_dir, filename)
        if not os.path.exists(fp):
            print(f'  NOT FOUND: {fp}')
            continue
        if patch_file(fp, ns_var, data, extras):
            count += 1
    print(f'\nDone: {count} files patched')

if __name__ == '__main__':
    main()

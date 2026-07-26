"""
Clean up and regenerate useT mocks for all 10 failing test files.

Removes ALL content between "Mock useT hook" comment and closing "));" 
of the vi.mock call, then inserts fresh mock block.
"""
import json
import os
import re
import sys

# ==== Translation data ====

ipos = {
    'dashboard': 'IPO Dashboard',
    'subtitleSummary': '{{open}} open · {{upcoming}} upcoming · {{listed}} listed',
    'activeIPOs': 'Active IPOs',
    'myApps': 'My Apps ({{count}})',
    'showingCount': '{{count}} IPO',
    'showingCount_plural': '{{count}} IPOs',
    'applyViaUPI': 'Apply via UPI',
    'noIPOs': 'No IPOs found',
    'noIPOsSub': 'Check back later for new IPOs',
    'appliedLabel': 'Applied: {{date}}',
    'openLabel': 'Open: {{date}}',
    'listingLabel': 'Listing: {{date}}',
    'subscriptionLabel': '{{value}}x',
    'subQIB': 'QIB',
    'subHNI': 'HNI',
    'subRetail': 'Ret',
    'priceBand': 'Price Band',
    'lot': 'Lot',
    'shares': 'shares',
    'minInvest': 'Min Investment',
    'gmp': 'GMP',
    'expectedListing': 'Exp. Listing',
    'statusOpen': 'Open Now',
    'statusListed': 'Listed',
    'statusUpcoming': 'Upcoming',
    'lots': 'Lots',
    'sharesLabel': 'Shares',
    'price': 'Price',
    'amount': 'Amount',
    'allottedLabel': 'Allotted',
    'listingPriceLabel': 'Listing Price',
    'gain': 'Gain',
    'upiLabel': 'UPI: {{id}}',
    'applyTitle': 'Apply via UPI',
    'numberOfLots': 'Number of Lots',
    'custom': 'Custom',
    'lotsSuffix': 'lots',
    'bidPriceLabel': 'Bid Price (\u20b9)',
    'cutOff': 'Cut-off',
    'higher': 'Higher',
    'upiIdLabel': 'UPI ID',
    'upiPlaceholder': 'e.g., name@hdfc',
    'pricePerShare': 'Price per share',
    'totalAmount': 'Total Amount',
    'submitting': 'Submitting...',
    'applyFor': 'Apply for {{amount}}',
    'upiInfo': 'Amount will be blocked in UPI until allotment',
    'invalidUpiTitle': 'Invalid UPI ID',
    'invalidUpiMsg': 'Please enter a valid UPI ID (e.g., name@bank).',
    'invalidLotsTitle': 'Invalid Lots',
    'invalidLotsMsg': 'Please select a valid number of lots.',
    'appSubmittedTitle': 'Application Submitted \u2705',
    'submitError': 'Failed to submit application',
    'filterAll': 'All',
    'filterOpen': 'Open',
    'filterUpcoming': 'Upcoming',
    'filterClosed': 'Closed',
    'filterListed': 'Listed',
    'filterActive': 'Active',
    'total': 'Total',
    'appSubmitted': 'Submitted',
    'appAllotted': 'Allotted',
    'appNotAllotted': 'Not Allotted',
    'invested': 'Invested',
    'profit': 'Profit',
    'noApplications': 'No Applications',
    'noAppsSub': 'Apply to an open IPO to see it here',
    'appCount': '{{count}}',
    'appCount_plural': '{{count}}',
    'appsTracked': '{{count}} applications tracked',
}

profile = {
    'profileKyc': 'Profile & KYC',
    'availableBalance': 'Available Balance',
    'lifetimeXp': 'Lifetime XP',
    'accountType': 'Account Type',
    'tradingAccount': 'Trading Account',
    'dpId': 'DP ID',
    'broker': 'Broker',
    'accountOpened': 'Account Opened',
    'panLabel': 'PAN',
    'emailLabel': 'Email',
    'phoneLabel': 'Phone',
    'personalInformation': 'Personal Information',
    'editProfile': 'Edit Profile',
    'editProfileSub': 'Name, email, phone',
    'changePassword': 'Change Password',
    'changePasswordSub': 'Update your login password',
    'notificationPreferences': 'Notification Preferences',
    'notificationPrefsSub': 'Manage alerts and updates',
    'kycStatus': 'KYC Status',
    'kycVerified': 'KYC Verified',
    'kycAndBanks': 'KYC & Banks',
    'accountDetails': 'Account Details',
    'accountDetailsSub': 'Your trading account information',
    'kycHelperText': 'Tap on a step to start verification. Complete all 4 steps to finish KYC.',
    'linkedBanks': 'Linked Bank Accounts',
    'banksLinked': '{{count}} account(s) linked',
    'primary': 'Primary',
    'ifsc': 'IFSC',
    'addBankAccount': 'Add Bank Account',
    'sectionInvestments': 'Investments',
    'sectionLearnAndGrow': 'Learn & Grow',
    'sectionAccount': 'Account',
    'referral': 'Refer & Earn',
    'homeWidget': 'Home Widget',
    'upiSettings': 'UPI Settings',
    'title': 'Profile',
    'account': 'Account',
    'help': 'Help & Support',
    'securitySettings': 'Security Settings',
    'replayTour': 'Replay Tour',
    'replayTourConfirm': 'This will restart the onboarding walkthrough.',
    'startTour': 'Start Tour',
    'goPremium': 'Go Premium',
    'paymentHistory': 'Payment History',
    'portfolioAlerts': 'Portfolio Alerts',
    'riskSettings': 'Risk Settings',
    'connectBroker': 'Connect Broker',
    'logout': 'Log Out',
    'logoutConfirm': 'Are you sure you want to log out?',
    'fnoTrading': 'F&O Trading',
    'opStrategies': 'Op. Strategies',
    'tradeHistory': 'Trade History',
    'openOrders': 'Open Orders',
    'reports': 'Reports',
    'messages': 'Messages',
    'more': 'More',
    'panVerification': 'PAN Verification',
    'aadhaarVerification': 'Aadhaar Verification',
    'digilocker': 'DigiLocker',
    'bankLinking': 'Bank Linking',
}

trading = {
    'buySecurities': 'Buy Securities',
    'sellSecurities': 'Sell Securities',
    'productType': 'Product Type',
    'marketDesc': 'Buy/Sell at current market price',
    'limitDesc': 'Execute only at your specified price or better',
    'stopLossDesc': 'Convert to market order when trigger price is hit',
    'stopLossMarketDesc': 'Market order that activates at trigger price',
    'cncDesc': 'Delivery \u2014 settle with actual shares',
    'misDesc': 'Intraday \u2014 square off by EOD',
    'nrmlDesc': 'Normal \u2014 for futures & options',
    'owned': '(Owned: {{count}})',
    'max': 'Max',
    'limitPrice': 'Limit Price (\u20b9)',
    'triggerPrice': 'Trigger Price (\u20b9)',
    'enterTriggerPrice': 'Enter trigger price',
    'triggerPriceRequired': 'Trigger price is required for Stop Loss orders',
    'pricePerShare': 'Price per share',
    'shares': 'shares',
    'estimatedTotal': 'Estimated Total',
    'estCharges': 'Est. Charges (brokerage + taxes)',
    'grandTotal': 'Grand Total',
    'balanceAvailable': 'Available: {{amount}}',
    'insufficientBalance': 'Insufficient balance \u2014 need {{amount}} more',
    'availableBalance': 'Available Balance',
    'stockNotFound': 'Stock not found',
    'goBack': 'Go Back',
    'processing': 'Processing...',
    'triggerPriceRequiredTitle': 'Trigger Price Required',
    'triggerPriceRequiredMsg': 'Please enter a trigger price for Stop Loss orders.',
    'bioConfirm': 'Confirm {{action}} order with {{label}}',
    'orderCancelled': 'Order Cancelled',
    'biometricFailed': 'Biometric verification failed.',
    'orderBlocked': 'Order Blocked',
    'orderPlacedSuccessfully': 'Order Placed Successfully!',
    'bought': 'Bought',
    'sold': 'Sold',
    'of': 'of',
    'price': 'Price',
    'time': 'Time',
    'done': 'Done',
    'riskEngineBlocked': 'Order blocked by risk engine.',
    'error': 'Error',
    'errorNoHolding': 'No holding found to sell.',
    'errorGeneric': 'There was an error placing your order.',
    'errorInsufficientMargin': 'Insufficient margin.',
    'errorInsufficientHoldings': 'Insufficient holdings to sell.',
    'errorLimitExceeded': 'Position limit exceeded.',
    'errorRejected': 'Order rejected by broker.',
    'errorNetwork': 'Network error.',
    'errorSessionExpired': 'Broker session expired.',
    'errorBroker': 'Broker error ({{status}}): {{message}}',
    'orderFailed': 'Order Failed',
    'quantityLabel': 'Quantity',
    'orderTypeLabel': 'Order Type',
}

education = {
    'myCourses': 'My Courses',
    'createManageSubtitle': 'Create and manage your own courses',
    'total': 'Total',
    'published': 'Published',
    'drafts': 'Drafts',
    'students': 'Students',
    'createNewCourse': 'Create New Course',
    'noCoursesYet': 'No courses yet',
    'noCoursesSubtitle': 'Tap "Create New Course" to start building your first course!',
    'submitForReview': 'Submit for Review',
    'cannotSubmit': 'Cannot Submit',
    'cannotSubmitMsg': 'Please add a title and at least one lesson before submitting for review.',
    'archiveCourse': 'Archive Course',
    'restoreCourse': 'Restore Course',
    'duplicate': 'Duplicate',
    'deleteCourse': 'Delete Course',
    'deleteCourseConfirm': 'Are you sure you want to delete "{{title}}"? This action cannot be undone.',
    'untitledCourse': 'Untitled Course',
    'noDescription': 'No description yet',
    'pending': 'Pending',
    'reviewStatus': 'Review Status',
    'pendingReview': '\U0001f7e1 Pending Review',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'needsChanges': '\u274c Rejected \u2014 Needs Changes',
    'submitted': 'Submitted',
    'courseOptions': 'Course Options',
    'communityCourses': 'Community Courses',
    'communitySubtitle': 'Discover courses created by fellow traders',
    'searchCoursesCreators': 'Search courses, creators, or topics...',
    'featuredCourses': 'Featured Courses',
    'title': 'Courses',
    'allCommunityCourses': 'All Community Courses',
    'filteredResults': 'Filtered ({{count}})',
    'noCoursesFound': 'No courses found',
    'noCoursesMatch': 'No courses match "{{query}}". Try a different search term.',
    'noCommunityCourses': 'No published community courses yet. Check back later!',
    'enroll': 'Enroll',
    'byCreator': 'by {{name}}',
    'enrolled': 'Enrolled',
    'lessonsCount': '{{count}} lessons',
    'courseNotFound': 'Course not found',
    'courseProgress': 'Course Progress',
    'completed': 'Completed',
    'remainingCount': 'Remaining',
    'aboutThisCourse': 'About this Course',
    'duration': 'Duration',
    'lessonsProgress': 'Lessons ({{completed}}/{{total}})',
    'lessonDone': 'Done',
    'lessonQuiz': 'Quiz',
    'nextLesson': 'Next Lesson',
    'startCourse': 'Start Course',
    'continueLearning': 'Continue',
    'viewCertificate': 'View Certificate',
    'getCertificate': '\U0001f393 Get Certificate',
    'rating': 'rating',
    'learningPaths': 'Learning Paths',
    'learningPathsSubtitle': 'Curated sequences to master the markets',
    'paths': 'Paths',
    'learners': 'Learners',
    'lessonsLabel': 'Lessons',
    'coursesProgress': '{{completed}}/{{total}} courses \u00b7 {{percent}}% complete',
    'continuePath': 'Continue Path \u2192',
    'startPath': 'Start Path \u2192',
    'sortCategory': 'Category',
    'allLevels': 'All Levels',
    'beginner': 'Beginner',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced',
}

time_translations = {
    'justNow': 'just now',
    'minutesAgo': '{{count}}m ago',
    'hoursAgo': '{{count}}h ago',
    'daysAgo': '{{count}}d ago',
}

errors_ns = {
    'unknown': 'An unexpected error occurred',
}

reports = {
    'title': 'Reports',
    'subtitle': 'Download and manage your reports',
    'contractNotes': 'Contract Notes',
    'download': 'Download',
    'upload': 'Upload',
    'uploadContractNote': 'Upload Contract Note',
    'selectFile': 'Select File',
    'noReports': 'No reports yet',
    'noReportsSub': 'Upload a contract note to get started',
    'processing': 'Processing...',
    'processed': 'Processed',
    'failed': 'Failed',
    'delete': 'Delete',
    'deleteConfirm': 'Are you sure you want to delete this report?',
    'reportType': 'Report Type',
    'dateRange': 'Date Range',
    'apply': 'Apply',
    'clear': 'Clear',
    'filter': 'Filter',
    'downloadPdf': 'Download PDF',
    'share': 'Share',
    'print': 'Print',
    'taxReport': 'Tax Report',
    'pAndL': 'P&L Statement',
    'tradeConfirmation': 'Trade Confirmation',
    'holdingStatement': 'Holding Statement',
}

FILES_CONFIG = {
    'IPODashboardScreen.test.tsx': ('ipos', ipos, {'errors': errors_ns}),
    'ProfileScreen.test.tsx': ('profile', profile, None),
    'PlaceOrderScreen.test.tsx': ('trading', trading, None),
    'PlaceOrderScreenFrozenFix.test.tsx': ('trading', trading, None),
    'CommunityCoursesScreen.test.tsx': ('education', education, {'time': time_translations}),
    'MyCoursesScreen.test.tsx': ('education', education, None),
    'CourseDetailScreen.test.tsx': ('education', education, None),
    'LearningPathsScreen.test.tsx': ('education', education, None),
    'ContractNoteUploadScreen.test.tsx': ('reports', reports, None),
    'ReportsScreen.test.tsx': ('reports', reports, None),
}

RESOLVE_T_CODE = '''
function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = { NS_PLACEHOLDER };
  const obj = translations[rootNs];
  if (!obj) return key;
  
  // Check for plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }
  
  // Fall back to singular
  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }
  
  return key;
}
'''

def build_mock_block(ns, data, extra_ns):
    """Build complete mock block."""
    ns_json = json.dumps(data, ensure_ascii=False, indent=2)
    extra_decls = ''
    ns_entries = ns
    
    if extra_ns:
        extra_parts = []
        for k, v in extra_ns.items():
            extra_parts.append(f"const {k} = {json.dumps(v, ensure_ascii=False)};")
        extra_decls = '\n' + '\n'.join(extra_parts)
        ns_entries += ', ' + ', '.join(f'...{k}' for k in extra_ns.keys())
    
    resolve_t = RESOLVE_T_CODE.replace('NS_PLACEHOLDER', ns_entries)
    
    return f'''
// ==================== Mock useT hook ====================
const {ns} = {ns_json};{extra_decls}

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
}}));'''


def patch_file(filepath, ns, data, extra_ns):
    """Cleanly remove old mock block and insert new one."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Find all lines that are part of the old mock block
    mock_start = None
    mock_end = None
    brace_depth = 0
    in_mock_block = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Detect start of mock block
        if 'Mock useT hook' in stripped and not in_mock_block:
            mock_start = i
            in_mock_block = True
            # We don't track brace depth at start - we'll use simpler detection
        
        # If we're in mock block, detect end
        if in_mock_block:
            # Count braces to find the end of the vi.mock(..., () => ({ ... }));
            # vi.mock(...) ends with )); on its own line
            if stripped == '));' or stripped == '}));' or stripped.startswith('}));'):
                # But this might match too early. Let's be more careful.
                # The vi.mock block looks like:
                # vi.mock('../hooks/useT', () => ({
                #   useT: () => ({...}),
                #   default: () => ({...}),
                # }));
                # So we need to find the line that's just "));" 
                pass
    
    # Simpler approach: use a two-phase regex
    # Phase 1: Remove ALL content between "Mock useT hook" and "));"
    content = ''.join(lines)
    
    # Pattern: from "Mock useT hook" comment down to the closing "));"
    # Use DOTALL to match across lines, and lazy quantifier
    old_mock_pattern = r'// ==================== Mock useT hook ====================\n.*?^\)\);\n'
    new_content = re.sub(old_mock_pattern, '', content, count=1, flags=re.DOTALL | re.MULTILINE)
    
    if new_content == content:
        # Pattern might not match (different whitespace). Try more aggressive:
        # Just remove any line with "Mock useT hook" and everything after until "));"
        lines_arr = content.split('\n')
        in_mock = False
        filtered = []
        for line in lines_arr:
            if 'Mock useT hook' in line:
                in_mock = True
            elif in_mock and line.strip() == '));':
                in_mock = False
                continue
            elif in_mock:
                continue
            
            if not in_mock:
                filtered.append(line)
        
        new_content = '\n'.join(filtered)
    else:
        # Regex worked. Now also clean up any remaining old const declarations
        # that might be orphaned
        # Actually this shouldn't happen with the regex
    
    # Clean up consecutive blank lines
    while '\n\n\n' in new_content:
        new_content = new_content.replace('\n\n\n', '\n\n')
    
    # Now insert the new mock block
    mock_block = build_mock_block(ns, data, extra_ns)
    
    # Find first import statement
    lines_arr = new_content.split('\n')
    insert_idx = -1
    for i, line in enumerate(lines_arr):
        if line.strip().startswith('import ') and not line.strip().startswith('//'):
            insert_idx = i
            break
    
    if insert_idx < 0:
        print(f"  ERROR: Could not find import in {filepath}")
        return False
    
    lines_arr.insert(insert_idx, mock_block)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines_arr))
    
    print(f"  PATCHED: {filepath}")
    return True


def main():
    test_dir = 'src/__tests__'
    patched = 0
    errors = 0
    
    for filename, (ns, data, extra_ns) in FILES_CONFIG.items():
        filepath = os.path.join(test_dir, filename)
        if not os.path.exists(filepath):
            print(f"  NOT FOUND: {filepath}")
            errors += 1
            continue
        
        if patch_file(filepath, ns, data, extra_ns):
            patched += 1
        else:
            errors += 1
    
    print(f"\nDone: {patched} patched, {errors} errors")

if __name__ == '__main__':
    main()
